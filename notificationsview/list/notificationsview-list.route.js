/*global angular*/
angular.module('TatUi').config(function($stateProvider, PluginProvider) {
  'use strict';

  PluginProvider.addPlugin({
    'name': 'Notifications View',
    'route': 'notificationsview-list',
    'type': 'messages-views',
    'topic': {
      'restricted': '/Private/.*/Notifications',
      'default': '/Private/.*/Notifications'
    }
  });

  $stateProvider.state('notificationsview-list', {
    url: '/notificationsview/list/{topic:topicRoute}?idMessage&filterInLabel&filterAndLabel&filterNotLabel&filterInTag&filterAndTag&filterNotTag',
    templateUrl: '../build/tatwebui-plugin-notificationsview/notificationsview/list/notificationsview-list.view.html',
    controller: 'MessagesNotificationsViewListCtrl',
    controllerAs: 'ctrl',
    reloadOnSearch: false,
    translations: [
      'plugins/tatwebui-plugin-notificationsview/notificationsview'
    ]
  });
});
