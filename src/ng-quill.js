(function() {
    'use strict';
    var app;
    // declare ngQuill module
    app = angular.module("ngQuill", ['angular-websocket']);

    app.service('ngQuillService', function() {
        this.lastEditorID = -1;
        this.editors = {};
        // formats list
        this.formats = [
            'link',
            'image',
            'bold',
            'italic',
            'underline',
            'strike',
            'color',
            'background',
            'align',
            'font',
            'size',
            'bullet',
            'list'
        ];

        this.scrollBottom = function(editorID) {
            var element = document.getElementById("editorJump" + editorID);
            if (element) {
                var alignToTop = ((editorID + 1 - Object.keys(this.editors).length) !== 0);
                console.log("scroll to element, align to top:" + alignToTop);
                element.scrollIntoView(alignToTop);
            } else {
                console.error("cannot find element to scroll to");
            }
        };

        this.scrollTop = function(editorID) {
            var element = document.getElementById("editorJumpTop" + editorID);
            if (element) {
                var alignToTop = ((editorID + 1 - Object.keys(this.editors).length) !== 0);
                console.log("scroll to element, align to top:" + alignToTop);
                element.scrollIntoView(alignToTop);
            } else {
                console.log("cannot find element to scroll to");
            }
        };


        // default translations
        this.defaultTranslation = {
            font: 'Font',
            eize: 'Size',
            small: 'Small',
            normal: 'Normal',
            large: 'Large',
            huge: 'Huge',
            bold: 'Bold',
            italic: 'Italic',
            underline: 'Underline',
            strike: 'Strikethrough',
            textColor: 'Text Color',
            backgroundColor: 'Background Color',
            list: 'List',
            bullet: 'Bullet',
            textAlign: 'Text Align',
            left: 'Left',
            center: 'Center',
            right: 'Right',
            justify: 'Justify',
            link: 'Link',
            image: 'Image',
            visitURL: 'Visit URL',
            change: 'Change',
            done: 'Done',
            cancel: 'Cancel',
            remove: 'Remove',
            insert: 'Insert',
            preview: 'Preview'
        };

        // validate formats
        this.validateFormats = function(checkFormats) {
            var correctFormats = [],
                self = this,
                i = 0;
            for (i; i < checkFormats.length; i = i + 1) {
                if (self.formats.indexOf(checkFormats[i]) !== -1) {
                    correctFormats.push(checkFormats[i]);
                }
            }
            return correctFormats;
        };

    });

    app.directive("ngQuillEditor", [
        '$timeout',
        'ngQuillService',
        '$websocket',
        '$rootScope',
        '$location',
        '$log',
        '$window',
        function($timeout, ngQuillService, $websocket, $rootScope, $location, $log, $window) {
            return {
                scope: {
                    'toolbarEntries': '@?',
                    'toolbar': '@?',
                    'linkTooltip': '@?',
                    'imageTooltip': '@?',
                    'theme': '@?',
                    'translations': '=?',
                    'required': '@?editorRequired',
                    'readOnly': '@?',
                    'errorClass': '@?',
                    'ngModel': '=',
                },

                require: 'ngModel',
                restrict: 'E',
                templateUrl: 'ngQuill/template.html',
                link: function($scope, element, attr, ngModel) {
                    var config = {
                            theme: $scope.theme || 'snow',
                            readOnly: $scope.readOnly || false,
                            formats: $scope.toolbarEntries ? ngQuillService.validateFormats($scope.toolbarEntries.split(' ')) : ngQuillService.formats,
                            modules: {}
                        },
                        changed = false,
                        editor,
                        editorID,
                        setClass = function() {
                            // if editor content length <= 1 and content is required -> add custom error clas and ng-invalid
                            if ($scope.required && (!$scope.modelLength || $scope.modelLength <= 1)) {
                                element.addClass('ng-invalid');
                                element.removeClass('ng-valid');
                                // if form was reseted and input field set to empty
                                if ($scope.errorClass && changed && element.hasClass('ng-dirty')) {
                                    element.children().addClass($scope.errorClass);
                                }
                            } else { // set to valid
                                element.removeClass('ng-invalid');
                                element.addClass('ng-valid');
                                if ($scope.errorClass) {
                                    element.children().removeClass($scope.errorClass);
                                }
                            }
                        };



                    // set required flag (if text editor is required)
                    if ($scope.required && $scope.required === 'true') {
                        $scope.required = true;
                    } else {
                        $scope.required = false;
                    }

                    // default translations
                    $scope.dict = ngQuillService.defaultTranslation;

                    $scope.shouldShow = function(formats) {
                        var okay = false,
                            i = 0;
                        for (i; i < formats.length; i = i + 1) {
                            if (config.formats.indexOf(formats[i]) !== -1) {
                                okay = true;
                                break;
                            }
                        }

                        return okay;
                    };

                    // if there are custom translations
                    if ($scope.translations) {
                        $scope.dict = $scope.translations;
                    }

                    // add tooltip modules
                    if ($scope.linkTooltip && $scope.linkTooltip === 'true') {
                        config.modules['link-tooltip'] = {
                            template: '<span class="title">' + $scope.dict.visitURL + ':&nbsp;</span>' + '<a href="#" class="url" target="_blank" href="about:blank"></a>' + '<input class="input" type="text">' + '<span>&nbsp;&#45;&nbsp;</span>' + '<a href="javascript:;" class="change">' + $scope.dict.change + '</a>' + '<a href="javascript:;" class="remove">' + $scope.dict.remove + '</a>' + '<a href="javascript:;" class="done">' + $scope.dict.done + '</a>'
                        };
                    }
                    if ($scope.imageTooltip && $scope.imageTooltip === 'true') {
                        config.modules['image-tooltip'] = {
                            template: '<input class="input" type="textbox">' + '<div class="preview">' + '    <span>' + $scope.dict.preview + '</span>' + '</div>' + '<a href="javascript:;" class="cancel">' + $scope.dict.cancel + '</a>' + '<a href="javascript:;" class="insert">' + $scope.dict.insert + '</a>'
                        };
                    }

                    // init editor
                    editor = new Quill(element[0].querySelector('.advanced-wrapper .editor-container'), config);
                    editorID = -1;
                    if (attr.editorid) {
                        editorID = parseInt(attr.editorid);
                    }
                    if (attr.focusthis === 'true') {
                        editor.focus();
                        var end = 0;
                        if (editor.getText && editor.getText()) {
                            end = editor.getText().length;
                        }
                        editor.insertText(end, "");

                        if (ngQuillService.lastEditorID !== editorID) {
                            ngQuillService.lastEditorID = editorID;
                            $rootScope.$emit('editorChanged', editorID);
                        }
                    }
                    $scope.editorID = editorID;
                    ngQuillService.editors[editorID] = editor;

                    // add toolbar afterwards with a timeout to be sure that translations has replaced.
                    if ($scope.toolbar && $scope.toolbar === 'true') {
                        $timeout(function() {
                            editor.addModule('toolbar', {
                                container: element[0].querySelector('.advanced-wrapper .toolbar-container')
                            });
                            $scope.toolbarCreated = true;
                        }, 0);
                    }

                    // provide event to get recognized when editor is created -> pass editor object.
                    $timeout(function() {
                        $scope.$emit('editorCreated', editor);
                    });

                    // set initial value
                    $scope.$watch(function() {
                        return $scope.ngModel;
                    }, function(newText) {
                        if (typeof newText === 'string' && !changed) {
                            // Set initial value;
                            editor.setHTML(newText);
                        }
                    });

                    $scope.regEx = /^([2-9]|[1-9][0-9]+)$/;

                    $scope.lines = function(insertAt, text, charPerLine) {
                        var line = 0;
                        var x = 0;
                        var posOnLine = 0;
                        while (x < text.length && x < insertAt) {
                            var oneChar = text.substring(x, x + 1);
                            var lines = oneChar.split(/\n/g);
                            if (lines.length > 1) {
                                line = line + 1;
                                posOnLine = 0;
                            } else {
                                posOnLine = posOnLine + 1;
                            }
                            if (posOnLine > charPerLine) {
                                posOnLine = 0;
                                line = line + 1;
                            }
                            x = x + 1;
                        }

                        return {
                            xPos: posOnLine,
                            qty: line
                        };
                    };

                    $scope.getScreenHeight = function() {
                        var top = $window.pageYOffset;
                        var bot = $window.innerHeight + $window.pageYOffset;
                        var height = bot - top;
                        var quort = height / 4;
                        var gapToEditor = (height / 100) * 14.79;
                        return {
                            top: top,
                            bottom: bot,
                            height: height,
                            quort: quort,
                            gap: gapToEditor
                        };
                    };

                    $scope.topOfEditor = function() {
                        var element = document.getElementById("editorJumpTop" + editorID);
                        if (editorID === 0) {
                            element = document.getElementById("editorJumpFirstTop");
                        }
                        var editorRect = element.getBoundingClientRect();
                        $log.debug("SCROLL: top id rect ");
                        $log.debug(editorRect);
                        return editorRect.top;
                    };

                    $scope.bottomOfBanner = function() {
                        var element = document.getElementById("patient-banner");
                        var editorRect = element.getBoundingClientRect();
                        return editorRect.bottom;
                    };



                    $scope.scrollScreen = function(postion, allText, charPerLine) {
                        $log.debug("  ========================== ");
                        var firstCharX = 36;
                        var lineHeight = 20;
                        var charWidth = 12;

                        var screenHeight = $scope.getScreenHeight();
                        var editorTop = $scope.topOfEditor();
                        var lines = $scope.lines(postion, allText, charPerLine);

                        var absoluteFirstLine = (screenHeight.top + editorTop) + 71;
                        var scrollLine = lines.qty * lineHeight;

                        var y = absoluteFirstLine + scrollLine - (lineHeight + $scope.bottomOfBanner());
                        var yDisplay = y + (1 * lineHeight);

                        $log.debug("SCROLL: Screen height");
                        $log.debug(screenHeight);
                        $log.debug("SCROLL: lines");
                        $log.debug(lines);
                        $log.debug("SCROLL: Editor top         - " + editorTop);
                        $log.debug("SCROLL: absoluteFirstLine  - " + absoluteFirstLine);
                        $log.debug("SCROLL: scrollLine         - " + scrollLine);
                        $log.debug("SCROLL: to                 - " + y);

                        if (yDisplay >= screenHeight.top && (yDisplay + (15 * lineHeight)) <= screenHeight.bottom) {
                            $log.debug("SCROLL: No scroll as " + yDisplay + " is on screen (between " + screenHeight.top + " - " + screenHeight.bottom + ")");
                        } else {
                            var x = firstCharX + (lines.xPos * charWidth);
                            $log.debug("SCROLL: To              - (" + x + "," + y + ") ");
                            $window.scrollTo(x, y);
                        }
                        $log.debug("  ************************** ");
                    };



                    // Update model on textchange
                    editor.on('text-change', function(delta, source) {
                        if (ngQuillService.lastEditorID !== editorID) {
                            ngQuillService.lastEditorID = editorID;
                            $rootScope.$emit('editorChanged', editorID);
                        }
                        $log.debug("EDIT text change");
                        $rootScope.$emit('text-change', {
                            delta: delta,
                            source: source
                        });
                        var oldChange = changed;
                        changed = true;
                        $timeout(function() {
                            // Calculate content length
                            $scope.modelLength = editor.getLength();
                            // Check if error class should be set
                            if (oldChange) {
                                setClass();
                            }
                            // Set new model value
                            // Set new model value
                            if (typeof ngModel !== 'undefined') {
                                ngModel.$setViewValue(editor.getHTML());
                            }

                            // Send to ws
                            if (attr.wsaddress && source === 'user' && $rootScope.quillws) {
                                delta.ops.forEach(function(entry) {
                                    var textUpdate = $scope.convertOperation(entry);
                                    $rootScope.quillws.send(JSON.stringify(textUpdate));
                                });
                            }
                        }, 0);
                    });

                    var die = $rootScope.$on("EDIT", function(event, textUpdate) {
                        if (ngQuillService.lastEditorID === editorID) {
                            $scope.fromCommand = true;
                            $log.debug("EDIT event found :" + textUpdate.action);
                            var allText = editor.container.outerText;
                            var charPerLine = editor.root.clientWidth / 11.25;
                            switch (textUpdate.action) {
                                case "INSERT":
                                    editor.insertText(textUpdate.start, textUpdate.text);
                                    $scope.scrollScreen(textUpdate.start, allText, charPerLine);
                                    break;
                                case "DELETE":
                                    editor.deleteText(textUpdate.start, textUpdate.start + textUpdate.numChars);
                                    editor.focus();
                                    var end = 0;
                                    if (editor.getText && editor.getText()) {
                                        end = editor.getText().length;
                                    }
                                    editor.insertText(end, "");
                                    $scope.scrollScreen(end, allText, charPerLine);
                                    break;
                                case "HIGHLIGHT":
                                    editor.setSelection(textUpdate.selStart, textUpdate.selStart + textUpdate.selNumChars);
                                    $scope.scrollScreen(textUpdate.selStart + textUpdate.selNumChars, allText, charPerLine);
                                    break;
                                case "CARETMOVED":
                                    //editor.setSelection(textUpdate.start, textUpdate.start);
                                    editor.insertText(textUpdate.start, "");
                                    $scope.scrollScreen(textUpdate.start, allText, charPerLine);
                                    break;
                                case "GETSYNC":
                                    var range;
                                    if (editor) {
                                        range = editor.getSelection();
                                    }

                                    if (range) {
                                        var update = {
                                            action: "SYNC",
                                            text: editor.getText(),
                                            start: range.start + (range.end - range.start),
                                            numChars: editor.getText().length,
                                            selStart: range.start,
                                            selNumChars: range.end - range.start
                                        };
                                    } else {
                                        var update = {
                                            action: "SYNC",
                                            text: "NOTHING TO SYNC",
                                            start: -1,
                                            numChars: -1,
                                            selStart: -1,
                                            selNumChars: -1
                                        };
                                    }
                                    $rootScope.quillws.send(JSON.stringify(update));
                                    break;
                                default:
                                    $log.error("Unknown action in text update: " + textUpdate.action);
                                    break;
                            }
                        }

                    });
                    $scope.$on("$destroy", function() {
                        editor = null;
                        die();
                    });


                    editor.on('selection-change', function(range, source) {
                        if (!$rootScope.quillws) {
                            $log.debug("No quill web socket, so swallowing selection change");
                            return;
                        }

                        if (range === null) {
                            $log.debug("No range for selection");
                            range = {};    
                        }

                        var allText = editor.container.outerText;
                        var charPerLine = editor.root.clientWidth / 11.25;
                        $scope.scrollScreen(range.start, allText, charPerLine);

                        if (source === 'user' || angular.isUndefined(source)) {
                            if (ngQuillService.lastEditorID !== editorID) {
                                ngQuillService.lastEditorID = editorID;
                                $rootScope.$emit('editorChanged', editorID);
                            }
                            var update;

                            if (range.start === range.end) {
                                update = {
                                    action: "SYNC",
                                    text: editor.getText()
                                };
                                $rootScope.quillws.send(JSON.stringify(update));
                                update = {
                                    action: "CARETMOVED",
                                    start: range.start
                                };
                            } else {
                                update = {
                                    action: "HIGHLIGHT",
                                    selStart: range.start,
                                    selNumChars: range.end
                                };
                            }
                            $rootScope.quillws.send(JSON.stringify(update));
                        } else {
                            $log.debug("Focus has gone");
                        }

                    });


                    $scope.convertOperation = function(operation) {
                        var result;

                        if (operation.retain) {
                            result = {
                                action: "RETAIN",
                                start: operation.retain
                            };
                        } else if (operation.insert) {
                            result = {
                                action: "INSERT",
                                text: operation.insert
                            };
                        } else if (operation.delete) {
                            result = {
                                action: "DELETE",
                                numChars: operation.delete
                            };
                        } else {
                            $log.error("Unrecognised opertioni:");
                            $log.error(opertion);
                        }

                        return result;
                    };
                }

            };
        }
    ]);

    app.run([
        '$templateCache',
        '$rootScope',
        'ngQuillService',
        function($templateCache, $rootScope, ngQuillService) {

            // put template in template cache
            return $templateCache.put('ngQuill/template.html',
                '<div ng-if="editorID > 0" id="editorJumpTop{{editorID}}"></div>' +
                '<div ng-if="editorID === 0" id="editorJumpFirstTop"></div>' +
                '<div id="content-container">' +
                '<div class="advanced-wrapper">' +
                '<div class="toolbar toolbar-container" ng-if="toolbar" ng-show="toolbarCreated">' +
                '<!-- <span ng-class="{talkOff:talkOff}" class="ql-format-group fl recording" >' +
                '<md-button ng-click="talkToggle()" class="md-fab single-icon record" aria-label="Record" title="Record">' +
                '<md-icon></md-icon>' +
                '</md-button>' +
                '</span> -->' +
                '<span class="ql-format-group" ng-if="shouldShow([\'font\', \'size\'])">' +
                '<select title="{{dict.font}}" class="ql-font" ng-if="shouldShow([\'font\'])">' +
                '<option value="sans-serif" selected="">Sans Serif</option>' +
                '<option value="serif">Serif</option>' +
                '<option value="monospace">Monospace</option>' +
                '</select>' +
                '<select title="{{dict.size}}" class="ql-size" ng-if="shouldShow([\'size\'])">' +
                '<option value="13px">{{dict.small}}</option>' +
                '<option value="18px" selected="">{{dict.normal}}</option>' +
                '<option value="32px">{{dict.large}}</option>' +
                '<option value="64px">{{dict.huge}}</option>' +
                '</select>' +
                '</span>' +
                '<span class="ql-format-group" ng-if="shouldShow([\'bold\', \'italic\', \'underline\', \'strike\'])">' +
                '<span title="{{dict.bold}}" class="ql-format-button ql-bold" ng-if="shouldShow([\'bold\'])"></span>' +
                '<span title="{{dict.italic}}" class="ql-format-button ql-italic" ng-if="shouldShow([\'italic\'])"></span>' +
                '<span title="{{dict.underline}}" class="ql-format-button ql-underline" ng-if="shouldShow([\'underline\'])"></span>' +
                '<span title="{{dict.strike}}" class="ql-format-button ql-strike" ng-if="shouldShow([\'strike\'])"></span>' +
                '</span>' +
                '<span class="ql-format-group" ng-if="shouldShow([\'color\', \'background\'])">' +
                '<select title="{{dict.textColor}}" class="ql-color" ng-if="shouldShow([\'color\'])">' +
                '<option value="rgb(0, 0, 0)" label="rgb(0, 0, 0)" selected=""></option>' +
                '<option value="rgb(230, 0, 0)" label="rgb(230, 0, 0)"></option>' +
                '<option value="rgb(255, 153, 0)" label="rgb(255, 153, 0)"></option>' +
                '<option value="rgb(255, 255, 0)" label="rgb(255, 255, 0)"></option>' +
                '<option value="rgb(0, 138, 0)" label="rgb(0, 138, 0)"></option>' +
                '<option value="rgb(0, 102, 204)" label="rgb(0, 102, 204)"></option>' +
                '<option value="rgb(153, 51, 255)" label="rgb(153, 51, 255)"></option>' +
                '<option value="rgb(255, 255, 255)" label="rgb(255, 255, 255)"></option>' +
                '<option value="rgb(250, 204, 204)" label="rgb(250, 204, 204)"></option>' +
                '<option value="rgb(255, 235, 204)" label="rgb(255, 235, 204)"></option>' +
                '<option value="rgb(255, 255, 204)" label="rgb(255, 255, 204)"></option>' +
                '<option value="rgb(204, 232, 204)" label="rgb(204, 232, 204)"></option>' +
                '<option value="rgb(204, 224, 245)" label="rgb(204, 224, 245)"></option>' +
                '<option value="rgb(235, 214, 255)" label="rgb(235, 214, 255)"></option>' +
                '<option value="rgb(187, 187, 187)" label="rgb(187, 187, 187)"></option>' +
                '<option value="rgb(240, 102, 102)" label="rgb(240, 102, 102)"></option>' +
                '<option value="rgb(255, 194, 102)" label="rgb(255, 194, 102)"></option>' +
                '<option value="rgb(255, 255, 102)" label="rgb(255, 255, 102)"></option>' +
                '<option value="rgb(102, 185, 102)" label="rgb(102, 185, 102)"></option>' +
                '<option value="rgb(102, 163, 224)" label="rgb(102, 163, 224)"></option>' +
                '<option value="rgb(194, 133, 255)" label="rgb(194, 133, 255)"></option>' +
                '<option value="rgb(136, 136, 136)" label="rgb(136, 136, 136)"></option>' +
                '<option value="rgb(161, 0, 0)" label="rgb(161, 0, 0)"></option>' +
                '<option value="rgb(178, 107, 0)" label="rgb(178, 107, 0)"></option>' +
                '<option value="rgb(178, 178, 0)" label="rgb(178, 178, 0)"></option>' +
                '<option value="rgb(0, 97, 0)" label="rgb(0, 97, 0)"></option>' +
                '<option value="rgb(0, 71, 178)" label="rgb(0, 71, 178)"></option>' +
                '<option value="rgb(107, 36, 178)" label="rgb(107, 36, 178)"></option>' +
                '<option value="rgb(68, 68, 68)" label="rgb(68, 68, 68)"></option>' +
                '<option value="rgb(92, 0, 0)" label="rgb(92, 0, 0)"></option>' +
                '<option value="rgb(102, 61, 0)" label="rgb(102, 61, 0)"></option>' +
                '<option value="rgb(102, 102, 0)" label="rgb(102, 102, 0)"></option>' +
                '<option value="rgb(0, 55, 0)" label="rgb(0, 55, 0)"></option>' +
                '<option value="rgb(0, 41, 102)" label="rgb(0, 41, 102)"></option>' +
                '<option value="rgb(61, 20, 102)" label="rgb(61, 20, 102)"></option>' +
                '</select>' +
                '<select title="{{dict.backgroundColor}}" class="ql-background" ng-if="shouldShow([\'background\'])">' +
                '<option value="rgb(0, 0, 0)" label="rgb(0, 0, 0)"></option>' +
                '<option value="rgb(230, 0, 0)" label="rgb(230, 0, 0)"></option>' +
                '<option value="rgb(255, 153, 0)" label="rgb(255, 153, 0)"></option>' +
                '<option value="rgb(255, 255, 0)" label="rgb(255, 255, 0)"></option>' +
                '<option value="rgb(0, 138, 0)" label="rgb(0, 138, 0)"></option>' +
                '<option value="rgb(0, 102, 204)" label="rgb(0, 102, 204)"></option>' +
                '<option value="rgb(153, 51, 255)" label="rgb(153, 51, 255)"></option>' +
                '<option value="rgb(255, 255, 255)" label="rgb(255, 255, 255)" selected=""></option>' +
                '<option value="rgb(250, 204, 204)" label="rgb(250, 204, 204)"></option>' +
                '<option value="rgb(255, 235, 204)" label="rgb(255, 235, 204)"></option>' +
                '<option value="rgb(255, 255, 204)" label="rgb(255, 255, 204)"></option>' +
                '<option value="rgb(204, 232, 204)" label="rgb(204, 232, 204)"></option>' +
                '<option value="rgb(204, 224, 245)" label="rgb(204, 224, 245)"></option>' +
                '<option value="rgb(235, 214, 255)" label="rgb(235, 214, 255)"></option>' +
                '<option value="rgb(187, 187, 187)" label="rgb(187, 187, 187)"></option>' +
                '<option value="rgb(240, 102, 102)" label="rgb(240, 102, 102)"></option>' +
                '<option value="rgb(255, 194, 102)" label="rgb(255, 194, 102)"></option>' +
                '<option value="rgb(255, 255, 102)" label="rgb(255, 255, 102)"></option>' +
                '<option value="rgb(102, 185, 102)" label="rgb(102, 185, 102)"></option>' +
                '<option value="rgb(102, 163, 224)" label="rgb(102, 163, 224)"></option>' +
                '<option value="rgb(194, 133, 255)" label="rgb(194, 133, 255)"></option>' +
                '<option value="rgb(136, 136, 136)" label="rgb(136, 136, 136)"></option>' +
                '<option value="rgb(161, 0, 0)" label="rgb(161, 0, 0)"></option>' +
                '<option value="rgb(178, 107, 0)" label="rgb(178, 107, 0)"></option>' +
                '<option value="rgb(178, 178, 0)" label="rgb(178, 178, 0)"></option>' +
                '<option value="rgb(0, 97, 0)" label="rgb(0, 97, 0)"></option>' +
                '<option value="rgb(0, 71, 178)" label="rgb(0, 71, 178)"></option>' +
                '<option value="rgb(107, 36, 178)" label="rgb(107, 36, 178)"></option>' +
                '<option value="rgb(68, 68, 68)" label="rgb(68, 68, 68)"></option>' +
                '<option value="rgb(92, 0, 0)" label="rgb(92, 0, 0)"></option>' +
                '<option value="rgb(102, 61, 0)" label="rgb(102, 61, 0)"></option>' +
                '<option value="rgb(102, 102, 0)" label="rgb(102, 102, 0)"></option>' +
                '<option value="rgb(0, 55, 0)" label="rgb(0, 55, 0)"></option>' +
                '<option value="rgb(0, 41, 102)" label="rgb(0, 41, 102)"></option>' +
                '<option value="rgb(61, 20, 102)" label="rgb(61, 20, 102)"></option>' +
                '</select>' +
                '</span>' +
                '<span class="ql-format-group" ng-if="shouldShow([\'list\', \'bullet\'])">' +
                '<span title="{{dict.list}}" class="ql-format-button ql-list" ng-if="shouldShow([\'list\'])"></span>' +
                '<span title="{{dict.bullet}}" class="ql-format-button ql-bullet" ng-if="shouldShow([\'bullet\'])"></span>' +
                '</span>' +
                '<span class="ql-format-group" ng-if="shouldShow([\'align\'])">' +
                '<select title="{{dict.textAlign}}" class="ql-align">' +
                '<option value="left" label="{{dict.left}}" selected=""></option>' +
                '<option value="center" label="{{dict.center}}"></option>' +
                '<option value="right" label="{{dict.right}}"></option>' +
                '<option value="justify" label="{{dict.justify}}"></option>' +
                '</select>' +
                '</span>' +
                '<span class="ql-format-group" ng-if="shouldShow([\'link\', \'image\'])">' +
                '<span title="{{dict.link}}" class="ql-format-button ql-link" ng-if="shouldShow([\'link\'])"></span>' +
                '<span title="{{dict.image}}" class="ql-format-button ql-image" ng-if="shouldShow([\'image\'])"></span>' +
                '</span>' +
                '</div>' +
                '<div class="editor-container"></div>' +
                '<input type="text" ng-model="modelLength" id="quillEditor-{{editorID}}" ng-if="required" ng-hide="true" ng-pattern="/^([2-9]|[1-9][0-9]+)$/">' +
                '</div>' +
                '</div>' +
                '<div id="editorJump{{editorID}}"></div>');

        }
    ]);
}).call(this);
