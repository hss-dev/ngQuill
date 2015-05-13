/*global Quill*/
(function() {
    'use strict';
    var app;
    // declare ngQuill module
    app = angular.module("ngQuill", []);

    app.service('ngQuillService', function() {
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
        // default translations
        this.defaultTranslation = {
            font: 'Font',
            size: 'Size',
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
        function($timeout, ngQuillService, $websocket, $rootScope, $location, $log) {
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
                    'ngModel': '='
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

                    // Update model on textchange
                    editor.on('text-change', function(delta, source) {
                        $scope.$emit('text-change', {
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
                            if (attr.wsaddress && source === 'user') {
                                delta.ops.forEach(function(entry) {
                                    var textUpdate = $scope.convertOperation(entry);
                                    $rootScope.quillws.send(JSON.stringify(textUpdate));
                                });
                            }
                        }, 0);
                    });

                    if (attr.wsaddress) {
                        try {
                            if (!$rootScope.quillws) {
                                if ($location.protocol() === 'http') {
                                    //                                $rootScope.quillws = $websocket('ws://192.168.44.30:8089');
                                    $rootScope.quillws = $websocket('ws://' + attr.wsaddress);
                                } else {
                                    $rootScope.quillws = $websocket('wss://' + attr.wsaddress);
                                }

                            }
                            $rootScope.talkOff = false;
                        } catch (ohwell) {
                            $rootScope.talkOff = true;
                            $log.error("Quill websocket has not connected");
                            $log.error(ohwell);
                        }
                        $rootScope.quillws.onMessage(function(message) {
                            var textUpdate = JSON.parse(message.data);

                            switch (textUpdate.action) {
                                case "INSERT":
                                    editor.insertText(textUpdate.start, textUpdate.text);
                                    break;
                                case "DELETE":
                                    editor.deleteText(textUpdate.start, textUpdate.start + textUpdate.numChars);
                                    break;
                                case "HIGHLIGHT":
                                    editor.setSelection(textUpdate.selStart, textUpdate.selStart + textUpdate.selNumChars);
                                    break;
                                case "CARETMOVED":
                                    editor.setSelection(textUpdate.start, textUpdate.start);
                                    break;
                                default:
                                    $log.error("Unknown action in text update: " + textUpdate.action);
                                    break;
                            }
                        });
                        $rootScope.$watch('talkOff', function(newValue, oldValue) {
                                if (newValue !== $scope.talkOff){
                                    $scope.talkOff = newValue;
                                }
                        });
                        $scope.talkToggle = function() {
                            var update = {
                                action: "MICOFF"
                            };
                            if ($rootScope.talkOff) {
                                $rootScope.talkOff = false;
                                update.action = "MICON";
                            } else {
                                $rootScope.talkOff = true;
                            }
                            $rootScope.quillws.send(JSON.stringify(update));
                        };

                        $rootScope.quillws.onClose = function() {
                            $log.error("quill websocket is closed");
                        };

                        $rootScope.quillws.onError(function(message) {
                            $log.error("quill websocket error");
                            $log.error(message);
                        });

                        editor.on('selection-change', function(range, source) {
                            if (source === 'user') {
                                var update;

                                if (range) {
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

                }
            };
        }
    ]);

    app.run([
        '$templateCache',
        '$rootScope',
        '$window',
        function($templateCache, $rootScope, $window) {

            // reset all quill editors (to not flood window object works only with ui-router)
            $rootScope.$on('$locationChangeSuccess', function() {
                if ($window.Quill && $window.Quill.editors && $window.Quill.editors.length) {
                    angular.forEach($window.Quill.editors, function(editor) {
                        editor.destroy();
                    });
                }
            });

            // put template in template cache
            return $templateCache.put('ngQuill/template.html',
                '<div id="content-container">' +
                '<div class="advanced-wrapper">' +
                '<div class="toolbar toolbar-container" ng-if="toolbar" ng-show="toolbarCreated">' +
                '<span ng-class="{talkOff:talkOff}" class="ql-format-group fl recording" >' +
                '<md-button ng-click="talkToggle()" class="md-fab single-icon record" aria-label="Record" title="Record">' +
                '<md-icon></md-icon>' +
                '</md-button>' +
                '</span>' +

                '<span class="ql-format-group" ng-if="shouldShow([\'font\', \'size\'])">' +
                '<select title="{{dict.font}}" class="ql-font" ng-if="shouldShow([\'font\'])">' +
                '<option value="sans-serif" selected="">Sans Serif</option>' +
                '<option value="serif">Serif</option>' +
                '<option value="monospace">Monospace</option>' +
                '</select>' +
                '<select title="{{dict.size}}" class="ql-size" ng-if="shouldShow([\'size\'])">' +
                '<option value="10px">{{dict.small}}</option>' +
                '<option value="13px" selected="">{{dict.normal}}</option>' +
                '<option value="18px">{{dict.large}}</option>' +
                '<option value="32px">{{dict.huge}}</option>' +
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
                '<input type="text" ng-model="modelLength" ng-if="required" ng-hide="true" ng-pattern="/^([2-9]|[1-9][0-9]+)$/">' +
                '</div>' +
                '</div>');
        }
    ]);
}).call(this);
