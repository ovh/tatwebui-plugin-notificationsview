/*global angular,_,moment */

/**
 * @ngdoc controller
 * @name TatUi.controller:MessagesNotificationsViewListCtrl
 * @requires TatUi.TatEngineMessagesRsc Tat Engine Resource Messages
 * @requires TatUi.TatEngineMessageRsc  Tat Engine Resource Message
 * @requires TatUi.TatEngine            Global Tat Engine service
 *
 * @description List Messages controller
 */
angular.module('TatUi')
  .controller('MessagesNotificationsViewListCtrl', function(
    $scope,
    $rootScope,
    $stateParams,
    Authentication,
    TatEngineMessagesRsc,
    TatEngineMessageRsc,
    TatEngineTopicRsc,
    TatEngineUserRsc,
    TatEngine,
    TatFilter,
    TatTopic,
    Flash,
    $translate,
    $interval,
    $location
  ) {
    'use strict';

    var self = this;
    this.topic = $stateParams.topic;

    self.filter = TatFilter.getCurrent();
    self.filterDialog = { x: 380, y: 62, visible: false };

    $scope.$on('filter-changed', function(ev, filter){
      self.data.skip = 0;
      self.data.displayMore = true;
      self.filter = angular.extend(self.filter, filter);
      self.refresh();
    });

    this.data = {
      messages: [],
      requestFrequency: 5000,
      count: 100,
      skip: 0,
      displayMore: true
    };

    this.filterPosition = {
      x: 380,
      y: 62,
      visible: false
    };

    this.filter = {};

    this.getCurrentDate = function() {
      return moment().format("YYYY/MM/DD-HH:MM");
    };

    this.currentDate = self.getCurrentDate();

    /**
     * @ngdoc function
     * @name loadMore
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description Try to load more messages
     */
    this.loadMore = function() {
      if (!self.loading) {
        self.moreMessage();
      }
    };

    this.getBrightness = function(rgb) {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(rgb);
      return result ?
        0.2126 * parseInt(result[1], 16) +
        0.7152 * parseInt(result[2], 16) +
        0.0722 * parseInt(result[3], 16) : 0;
    };

    /**
     * @ngdoc function
     * @name deleteMessage
     * @methodOf TatUi.controller:messagesItem
     * @description delete a message from a Private topic
     */
    this.deleteMessage = function(message) {
      TatEngineMessageRsc.delete({
        'idMessage': message._id
      }).$promise.then(function(resp) {
        TatEngine.displayReturn(resp);
        message.hide = true;
        message.displayed = false;
      }, function(response) {
        TatEngine.displayReturn(response);
      });
    };

    /**
     * @ngdoc function
     * @name deleteMessages
     * @methodOf TatUi.controller:messagesItem
     * @description delete all messages in topic
     */
    this.deleteMessages = function() {
      TatEngineTopicRsc.truncate({
        'topic': self.topic
      }).$promise.then(function(resp) {
        TatEngine.displayReturn(resp);
        self.refresh();
      }, function(response) {
        TatEngine.displayReturn(response);
      });
    };

    /**
     * @ngdoc function
     * @name mergeMessages
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description Merge messages in the current message list
     * @param {string} messages Message list to merge
     */
    this.mergeMessages = function(dest, source) {
      if (source && _.isArray(source)) {
        for (var i = 0; i < source.length; i++) {
          var origin = _.find(dest, {
            _id: source[i]._id
          });
          if (origin) {
            if (!origin.replies) {
              origin.replies = [];
            }
            self.mergeMessages(origin.replies, source[i].replies);
            origin.labels = source[i].labels;
            origin.likers = source[i].likers;
            origin.nbLikes = source[i].nbLikes;
            origin.nbReplies = source[i].nbReplies;
            origin.tags = source[i].tags;
          } else {
            if (!self.data.intervalTimeStamp) {
              self.data.intervalTimeStamp = source[i].dateUpdate;
            } else if (source[i].dateUpdate > self.data.intervalTimeStamp) {
              self.data.intervalTimeStamp = source[i].dateUpdate;
            }
            dest.push(source[i]);
            dest.sort(function(a, b) {
              if (a.dateCreation > b.dateCreation) {
                return -1;
              }
              if (a.dateCreation < b.dateCreation) {
                return 1;
              }
              return 0;
            });
          }
        }
      }
      return dest;
    };

    /**
     * @ngdoc function
     * @name beginTimer
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description Launch the timer to request messages at regular time interval
     */
    this.beginTimer = function() {
      self.data = angular.extend(self.data, TatTopic.getDataTopic());
      var timeInterval = self.data.requestFrequency;
      if ('undefined' === typeof self.data.timer) {
        self.getNewMessages(); // Don't wait to execute first call
        self.data.timer = $interval(self.getNewMessages, timeInterval);
        $scope.$on("$destroy",function() { self.stopTimer(); });
      }
    };

    /**
     * @ngdoc function
     * @name stopTimer
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description Stop the time that request messages at regular time interval
     */
    this.stopTimer = function() {
      $interval.cancel(self.data.timer);
      self.data.timer = undefined;
    };

    /**
     * @ngdoc function
     * @name buildFilter
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description Build a filter to read messages
     * @param {object} data Custom data to send to the API
     * @return {object} Parameters to pass to the API
     */
    this.buildFilter = function(data) {
      return angular.extend({}, data, self.filter);
    };

    // return value of a tag like 'key:value'
    this.getTagValue = function(message, key) {
      for (var i = 0; i < message.tags.length; i++) {
        if (message.tags[i].indexOf(key) == 0) {
          return message.tags[i].substring(message.tags[i].indexOf(':') + 1);
        }
      }
      return undefined;
    }

    this.seeMsg = function(message) {
      var idMessage = this.getTagValue(message, 'idMessage:');
      var topic = this.getTagValue(message, 'topic:');
      this.addLabelRead(message);
      $rootScope.$broadcast('topic-change', {
        topic: topic,
        idMessage: idMessage,
        reload: true
      });
    };

    this.addLabelUnread = function(message) {
      message.currentLabel = {};
      message.currentLabel.text = "unread";
      message.currentLabel.color = "#d04437"; // red
      self.addLabel(message, function() {
        self.removeLabel(message, "read");
      });
    };

    this.addLabelRead = function(message) {
      message.currentLabel = {};
      message.currentLabel.text = "read";
      message.currentLabel.color = "#14892c"; // green
      self.addLabel(message, function() {
        self.removeLabel(message, "unread");
      });
    };

    /**
     * @ngdoc function
     * @name removeLabel
     * @methodOf TatUi.controller:messagesItem
     * @description remove a label
     * @param {object} message Message on which to add a label
     * @param {object} label   Label {text} to remove
     */
    this.removeLabel = function(message, labelText) {
      if (!message.labels) {
        return;
      }
      if (!self.containsLabel(message, labelText)) {
        return;
      }
      var toRefresh = false;
      var newList = [];
      for (var i = 0; i < message.labels.length; i++) {
        var l = message.labels[i];
        if (l.text === labelText) {
          toRefresh = true;
          TatEngineMessageRsc.update({
            'action': 'unlabel',
            'topic': this.topic,
            'idReference': message._id,
            'text': l.text
          }).$promise.then(function(resp) {
            //nothing here
          }, function(resp) {
            TatEngine.displayReturn(resp);
          });
        } else {
          newList.push(l);
        }
      }

      if (toRefresh)  {
        message.labels = newList;
      }
    };

    /**
     * @ngdoc function
     * @name addLabel
     * @methodOf TatUi.controller:messagesItem
     * @description Add a label
     * @param {object} message Message on which to add a label
     */
    this.addLabel = function(message, cb) {
      if (self.containsLabel(message, message.currentLabel.text)) {
        return;
      }
      TatEngineMessageRsc.update({
        'action': 'label',
        'topic': this.topic,
        'idReference': message._id,
        'text': message.currentLabel.text,
        'option': message.currentLabel.color
      }).$promise.then(function(resp) {
        if (!message.labels) {
          message.labels = [];
        }
        message.labels.push({
          text: message.currentLabel.text,
          color: message.currentLabel.color
        });
        message.currentLabel.text = '';
        if (cb) {
          cb();
        }
      }, function(resp) {
        TatEngine.displayReturn(resp);
      });
    };

    this.getTextWithoutMsgId = function(msg)  {
      return msg.text.replace(/#mention/, "")
        .replace(/#idMessage:[\w\d\-@\.\/]*/g, "");
    };

    /**
     * @ngdoc function
     * @name getNewMessages
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description Request for new messages
     */
    this.getNewMessages = function() {
      self.loading = true;
      self.currentDate = self.getCurrentDate();
      var filterAttrs = {
        topic: self.topic
      };
      if (!TatFilter.containsDateFilter) {
        filterAttrs.dateMinUpdate = self.data.intervalTimeStamp;
      }
      var filter = self.buildFilter(filterAttrs);
      return TatEngineMessagesRsc.list(filter).$promise
        .then(function(data) {
          self.digestInformations(data);
        }, function(err) {
          TatEngine.displayReturn(err);
          self.loading = false;
        });
    };

    /**
     * @ngdoc function
     * @name moreMessage
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description Request more messages
     * @return {object} Promise
     */
    this.moreMessage = function() {
      self.loading = true;
      var filter = self.buildFilter({
        topic: self.topic,
        limit: self.data.count,
        skip: self.data.skip
      });
      return TatEngineMessagesRsc.list(filter).$promise
        .then(function(data) {
          if (!data.messages) {
            self.data.displayMore = false;
          } else {
            self.data.skip = self.data.skip + self.data.count;
            self.digestInformations(data);
          }
        }, function(err) {
          TatEngine.displayReturn(err);
          self.loading = false;
        });
    };

    /**
     * @ngdoc function
     * @name digestInformations
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description
     * @return
     */
    this.digestInformations = function(data) {
      self.data.isTopicRw = data.isTopicRw;
      if (_.includes(Authentication.getIdentity().favoritesTopics, '/' +
          self.topic)) {
        self.data.isFavoriteTopic = true;
      }
      self.data.messages = self.mergeMessages(self.data.messages, data.messages);
      self.loading = false;
    };

    /**
     * @ngdoc function
     * @name init
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description Initialize list messages page. Get list of messages from Tat Engine
     */
    this.init = function() {
      TatTopic.computeTopic(self.topic, self.beginTimer);
    };


    /**
     * @ngdoc function
     * @name refresh
     * @methodOf TatUi.controller:MessagesNotificationsViewListCtrl
     * @description Refresh all the messages
     */
    this.refresh = function() {
      self.data.currentTimestamp = Math.ceil(new Date().getTime() / 1000);
      self.data.messages = [];
      self.moreMessage();
    };

    /**
     * @ngdoc function
     * @name isRead
     * @methodOf TatUi.controller:messagesItem
     * @description Return true if message contains a doing label
     */
    this.isRead = function(message) {
      return self.containsLabel(message, "read");
    };

    /**
     * @ngdoc function
     * @name isUnread
     * @methodOf TatUi.controller:messagesItem
     * @description Return true if message contains a done label
     */
    this.isUnread = function(message) {
      return self.containsLabel(message, "unread");
    };

    this.containsLabel = function(message, labelText) {
      if (message.inReplyOfIDRoot) {
        return false;
      }
      var r = false;
      if (message.labels) {
        for (var i = 0; i < message.labels.length; i++) {
          var l = message.labels[i];
          if (l.text === labelText) {
            return true;
          }
        }
      }
      return r;
    };

    this.init();
  });
