(function() {
    'use strict';

    angular.module('cb.main', ['ngResource', 'cb.common'])
        .controller('mainMenuCtrl', [
            '$scope',
            '$log',
            '$mdDialog',
            '$state',
            '$rootScope',
            'setting',
            'analytics',
            'User',
            'message',
            'Report',
            'Transport',
            '$q',
            '$interval',
            '$http',
            'Error',
            'Lookups',
            '$cookies',
            '$websocket',
            '$location',
            'ngQuillService',
            function($scope, $log, $mdDialog, $state, $rootScope, setting, analytics, User, message, Report, Transport, $q, $interval, $http, Error, Lookups, $cookies, $websocket, $location, ngQuillService) {
                $log.debug("Main Controller");

                var mainCtrl = $scope;
                mainCtrl.setting = setting;

                var canExit = function() {
                    var weAreHere = "" + $state.current.name;
                    if (weAreHere === 'report') {
                        $log.debug("Asked to exit, but refusing as reporting is in progress");
                        if (angular.isDefined(Report.exam)) {
                            var status = Report.exam.reportStatus;
                            if (status !== 'VERIFIED' || Report.doingAddendum) {
                                message.showToast("Disabled whilst reporting", "warning");
                                return false;
                            }
                        }
                    }
                    return true;
                };

                mainCtrl.go = function(a) {

                    if (canExit()) {
                        mainCtrl.state = a;
                        $state.go(a);
                    }
                };

                mainCtrl.state = "dashboard";

                mainCtrl.switchTheme = function(t) {
                    if (t) {
                        mainCtrl.theme = t;
                    }
                    if (mainCtrl.theme === "Normal") {
                        analytics.log("Main", "Dark theme has been selected");
                        mainCtrl.theme = "dark-theme";
                    } else {
                        analytics.log("Main", "Normal theme has been selected");
                        mainCtrl.theme = "Normal";
                    }
                    setTheme(mainCtrl.theme);
                    User.saveSettings();
                };

                var setTheme = function(t) {
                    if (!t) {
                        t = 'Normal';
                    }
                    mainCtrl.theme = t;
                    mainCtrl.normal = (t === 'Normal');
                    setting.theme = t;
                    if (!User.prefs) {
                        User.prefs = {};
                    }
                    User.prefs.theme = t;
                    $rootScope.$emit('newTheme', mainCtrl.theme);
                };

                mainCtrl.talk = 'off';
                mainCtrl.changeTalk = function(state) {
                    mainCtrl.talk = state;
                    $rootScope.talkOff = true;
                    var update = {
                        action: "MICROPHONESLEEP"
                    };
                    if (state === 'on') {
                        $rootScope.talkOff = false;
                        update.action = "MICROPHONEON";
                    }
                    if (state === 'off') {
                        update.action = "MICROPHONEOFF";
                    }
                    if ($rootScope.quillws) {
                        $rootScope.quillws.send(JSON.stringify(update));
                    }
                };

                mainCtrl.toggleInter = function() {
                    mainCtrl.showInter = !mainCtrl.showInter;
                };

                mainCtrl.switchInter = function() {
                    mainCtrl.dti(!mainCtrl.setting.dtiTriggerOff);
                    //                    if (mainCtrl.setting.dtiTriggerOff) {
                    //                        message.showToast("Integration is on");
                    //                    } else {
                    //                        message.showToast("Integration is off");
                    //                    }
                };

                mainCtrl.dti = function(off) {
                    mainCtrl.setting.dtiTriggerOff = off;
                    $cookies.put('dtiTriggerOff', off);
                };

                mainCtrl.setTrigURL = function(add, noToast) {
                    mainCtrl.setting.dtiTriggerADDR = add;
                    mainCtrl.setting.dtiTriggerURL = mainCtrl.setting.dtiTriggerPRO + mainCtrl.setting.dtiTriggerADDR + ":" + mainCtrl.setting.dtiTriggerPORT + mainCtrl.setting.dtiTriggerPATH;
                    $cookies.put('dtiTriggerADDR', add);
                    if (noToast) {
                        return;
                    }
                    message.showToast("Integration address has changed to: " + mainCtrl.setting.dtiTriggerURL);
                };

                mainCtrl.open = 'widget-shown';
                $rootScope.sideOpen = true;
                mainCtrl.toggleWidget = function() {
                    if (mainCtrl.open === 'widget-shown') {
                        analytics.log("main", "Side bar has been toggled closed");
                        mainCtrl.open = '';
                        $rootScope.sideOpen = false;
                    } else {
                        analytics.log("main", "Side bar has been toggled open");
                        mainCtrl.open = 'widget-shown';
                        $rootScope.sideOpen = true;
                    }
                    User.prefs.widgetShown = mainCtrl.open;
                    User.prefs.sideOpen = $rootScope.sideOpen;
                    User.saveSettings();
                };

                mainCtrl.displaySettings = false;
                mainCtrl.toggleDisplay = function() {
                    mainCtrl.displaySettings = !mainCtrl.displaySettings;
                    analytics.log("main", "user settings has been toggled to " + mainCtrl.displaySettings);
                    User.prefs.displayeSettings = mainCtrl.displaySettings;
                    User.saveSettings();
                };

                mainCtrl.toastPosition = {
                    bottom: true
                };

                mainCtrl.getToastPosition = function() {
                    var what = Object.keys(mainCtrl.toastPosition)
                        .filter(function(pos) {
                            return mainCtrl.toastPosition[pos];
                        })
                        .join(' ');
                    return what;
                };

                mainCtrl.showAdvanced = function(ev) {
                    $state.go('editRule', {
                        'filterName': ''
                    });

                };
                mainCtrl.drafts = [];
                mainCtrl.deleteDrafts = function(d) {
                    var proms = d.ids.map(function(examID) {
                        return Transport.deleteDraftReportFromExamID(examID);
                    });
                    $q.all(proms).then(function(d) {
                        message.showToast("Draft report has been deleted", "warning");
                    });
                };

                mainCtrl.gotoDraft = function(draft) {
                    if (canExit()) {
                        $state.go('report', {
                            'examID': draft.examID,
                            'filterName': draft.filterID,
                            'examCode': draft.examCode
                        });
                    }
                };

                mainCtrl.updateDrafts = function(event, toState, toParams, fromState, fromParams) {
                    mainCtrl.drafts = [];
                    Transport.loadAllDraftReports().then(function(d) {
                        var uniqueID = [];
                        if (d === 404) {
                            mainCtrl.drafts = [];
                        } else {
                            mainCtrl.drafts = d.map(function(rep) {
                                var r = JSON.parse(rep);
                                var examIDs = Object.keys(r).filter(function(k) {
                                    return (!isNaN(k));
                                });
                                return {
                                    "examID": r.examID,
                                    "name": r.name,
                                    "filterID": r.filterID,
                                    "examCode": r.examCode,
                                    "desc": r.desc,
                                    "date": r.saved,
                                    "ids": examIDs
                                };
                            }).filter(function(draft) {
                                if (uniqueID.indexOf(draft.examID) > -1) {
                                    return false;
                                }
                                var matches = draft.ids.filter(function(id) {
                                    return (uniqueID.indexOf(id) > -1);
                                });
                                var unique = (matches.length === 0);
                                if (unique) {
                                    uniqueID.push.apply(uniqueID, draft.ids);
                                    return true;
                                }
                                return false;
                            }).sort(function(draft1, draft2) {
                                return mainCtrl.sortDates(draft1, draft2);
                            });
                        }
                    });

                };
                mainCtrl.sortDates = function(draft1, draft2) {
                    var one = new Date(draft1.date).getTime();
                    var two = new Date(draft2.date).getTime();
                    if (one < two) {
                        return -1;
                    } else if (two < one) {
                        return 1;
                    }
                    return 0;
                };

                mainCtrl.nextDigest = function() {
                    $interval(mainCtrl.updateDrafts, 0, 1, true, 0);
                };

                mainCtrl.toggleSending = function() {
                    mainCtrl.showSend = !mainCtrl.showSend;
                };

                mainCtrl.setSettings = function() {
                    if (User.prefs.theme) {
                        setTheme(User.prefs.theme);
                        mainCtrl.open = User.prefs.widgetShown;
                        $rootScope.sideOpen = User.prefs.sideOpen;
                        mainCtrl.displaySettings = mainCtrl.displaySettings;
                    }
                };

                mainCtrl.processMessage = function(socketMessage) {
                    //message.showUpdate('Voice command:"'+socketMessage.action+'"');
                    var editingCommands = ["INSERT", "DELETE", "HIGHLIGHT", "CARETMOVED"];
                    if (editingCommands.contains(socketMessage.action)) {
                        $rootScope.$emit("EDIT", socketMessage);
                    } else {
                        var func = ngQuillService.socketCommands[socketMessage.action];
                        if (func) {
                            func();
                        } else {
                            message.showToast('Unknown voice command:"' + socketMessage.action + '"', 'danger');
                            $log.error("Unknown action in text update: " + socketMessage.action);
                        }
                    }
                };
                var die = $rootScope.$on('$stateChangeStart',
                    function(event, toState, toParams, fromState, fromParams) {
                        mainCtrl.state = toState.name;
                    });
                var die2 = $rootScope.$on('draftchanges', mainCtrl.nextDigest);
                var die3 = $rootScope.$on('loadedSettings', mainCtrl.setSettings);
                var die4 = $rootScope.$on('loadedMessage', function(datas) {});
                var die5 = $rootScope.$on("MIC", function(event, state) {
                    $log.debug("mic broadcast picked up with state");
                    $log.debug(state);
                    mainCtrl.changeTalk(state);
                });

                $scope.$on("$destroy", function() {
                    die();
                    die2();
                    die3();
                    die4();
                    die5();
                });


                mainCtrl.theme = 'Normal';
                mainCtrl.normal = true;


                User.populate("mainMenu", mainCtrl).then(function(u) {
                    mainCtrl.updateDrafts();
                    User.loadMessages();
                    mainCtrl.User = User;
                    Lookups.populateStandard().then(function(lookup) {
                        mainCtrl.finalSetup(lookup);
                    });
                });

                mainCtrl.finalSetup = function(lookup) {
                    mainCtrl.allUsers = Lookups.lookups.users;
                    mainCtrl.validateUser = function(text) {
                        if (angular.isUndefined(text) || text === null) {
                            return true;
                        }
                        var found = userMatch(text);
                        mainCtrl.sendToValid = found.length > 0;
                        return mainCtrl.sendToValid;
                    };

                    var userMatch = function(query) {
                        var lowercaseQuery = angular.lowercase(query);
                        var list = mainCtrl.allUsers.filter(function(user) {
                            return (angular.lowercase(user.username) === lowercaseQuery);
                        });
                        return list;
                    };

                    mainCtrl.getMatches = function(query) {
                        var lowercaseQuery = angular.lowercase(query);
                        var list = mainCtrl.allUsers.filter(function(user) {
                            return (user.username.indexOf(lowercaseQuery) > -1);
                        });
                        return list;
                    };

                    mainCtrl.sendMessage = function(m, s) {
                        User.sendMessage(m, s).then(function() {
                            message.showToast("Message has been sent to " + s, "normal");
                        });
                    };

                    mainCtrl.markedAsRead = function(m) {
                        User.markedAsRead(m).then(function() {
                            message.showToast("Message has been been marked as read");
                        });
                    };

                    try {
                        var fromCookie = $cookies.get('dtiTriggerADDR');
                        if (fromCookie) {
                            mainCtrl.setTrigURL(fromCookie, true);
                        }
                    } catch (rubbish) {
                        //bad cookie      
                    }
                    try {
                        mainCtrl.dti($cookies.get('dtiTriggerOff'));
                    } catch (rubbish) {
                        //bad cookie      
                    }

                    mainCtrl.voiceSocket = "Yet to connect";
                    if ($rootScope.quillws) {
                        mainCtrl.voiceSocket = "already to connect";
                    } else {
                        var wsaddress = "localhost:8089";
                        try {
                            if ($location.protocol() === 'http') {
                                $rootScope.quillws = $websocket('ws://' + wsaddress);
                            } else {
                                $rootScope.quillws = $websocket('wss://' + wsaddress);
                            }
                            $rootScope.quillws.onMessage(function(msg) {
                                mainCtrl.processMessage(JSON.parse(msg.data));
                            });
                            mainCtrl.voiceSocket = "Connected";
                            $rootScope.quillws.onError(function(msg) {
                                mainCtrl.voiceSocket = "Error connecting";
                                $log.error(msg);
                                $rootScope.talkOff = true;
                            });
                            $rootScope.quillws.onClose(function(msg) {
                                //mainCtrl.voiceSocket = "Closed connecting";
                                $rootScope.talkOff = true;
                            });
                        } catch (ohwell) {
                            mainCtrl.voiceSocket = "Failed to connect";
                            $rootScope.talkOff = true;
                            $log.error("Quill websocket has not connected");
                            $log.error(ohwell);
                        }

                    }

                };

            }
        ]);
}());
