'use strict';

Components.utils.import('resource:///modules/CustomizableUI.jsm'); // Require Gecko 29 and later
Components.utils.import('resource://gre/modules/osfile.jsm'); // Require Gecko 27 and later
Components.utils.import('resource://gre/modules/Downloads.jsm'); // Require Gecko 26 and later
Components.utils.import('resource://gre/modules/NetUtil.jsm'); // Promise chain that require Gecko 25 and later

var Utilities = {}, PlayerRules = {}, FilterRules = {}, RefererRules = {};

var Services = {
  io: Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService),
  obs: Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService),
  pps: Components.classes['@mozilla.org/network/protocol-proxy-service;1'].getService(Components.interfaces.nsIProtocolProxyService),
  prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).QueryInterface(Components.interfaces.nsIPrefBranch),
  sss: Components.classes['@mozilla.org/content/style-sheet-service;1'].getService(Components.interfaces.nsIStyleSheetService),
  strings: Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService),
};

var FileIO = {
  addFolder: function () {
    OS.File.makeDir(this.extDir);
  },
  delFolder: function () {
    OS.File.removeDir(this.extDir);
  },
};

var Adapter = {
/** Some sites have shared player/filter just like 'youku' and 'tudou', use the template to match them;
    一些网站像优酷与土豆一样共用player或filter，请参考下面的模板进行匹配 */
  groupA: {
    site: ['youku', 'tudou'], // 列举在第一个的享有优先权，改动它的参数会根据绑定的不同影响其他站点的参数。
    pref: 'filter',
  }
};

var SiteLists = {
/**  Template sample to add new site
     请参考下面模板添加新的网站  */
  'youku': {
  /**  Multilingual label & tooltiptext must be addded in function, better in CustomizableUI.addwidget()
       多国语言的菜单信息必须添加在function里，最好添加在下面的CustomizableUI.addwidget()中。  */
//  label: 'Youku.com',
//  tooltiptext: 'http://www.youku.com',
    target: /http:\/\/static\.youku\.com\/.+player.*\.swf/i, // 匹配到网站播放器时显示菜单选项
    url: /http:\/\/[^\/]+youku\.com\//i, // 匹配到网站地址时显示菜单选项
    name: 'rule.youku.defined',
    type: 'integer',
    value: 2,
    hasPlayer: true,
    hasFilter: true,
    hasReferer: true, // true:请按照下面格式添加referer参数
    referer: {
//    label: 'Youku Referer',
//    tooltiptext: 'Spoofing HTTP Referer of Youku.com',
      name: 'referer.youku.enabled',
      type: 'bool',
      value: true,
    },
    getPlayer: function () {
      PlayerRules['youku_loader'] = {
        object: FileIO.path + 'loader.swf',
        remote: FileIO.link + 'loader.swf',
        string: /http:\/\/static\.youku\.com\/.*\/v\/swf\/loaders?\.swf/i,
      };
      PlayerRules['youku_player'] = {
        object: FileIO.path + 'player.swf',
        remote: FileIO.link + 'player.swf',
        string: /http:\/\/static\.youku\.com\/.*\/v\/swf\/q?player.*\.swf/i,
      };
    },
    setPlayer: function (aState) {
      RuleExecution.toggle(aState, PlayerRules['youku_loader']);
      RuleExecution.toggle(aState, PlayerRules['youku_player']);
    },
    getFilter: function () {
      FilterRules['youku_tudou'] = {
        string: /http:\/\/val[fcopb]\.atm\.youku\.com\//i,
  /**  mode 0: faster but less compatible, mode 1: more compatible but slower.
       模式0： 更快但是兼容性更差，模式1：兼容性更好但是相对慢些  */
        mode: 0,
      };
    },
    setFilter: function (aState) {
      RuleExecution.toggle(aState, FilterRules['youku_tudou']);
    },
    getReferer: function () {
      RefererRules['referer-youku'] = {
        object: 'http://www.youku.com/',
        string: /http:\/\/.*\.youku\.com/i,
      };
    },
    setReferer: function (aState) {
      RuleExecution.toggle(aState, RefererRules['referer-youku']);
    },
  },
/**  Template End
     模板结束  */
  'tudou': {
    target: /http:\/\/js\.tudouui\.com\/.+player.+\.swf/i,
    url: /http:\/\/[^\/]+tudou\.com\//i,
    name: 'rule.tudou.defined',
    type: 'integer',
    value: 2,
    hasPlayer: true,
    hasFilter: true,
    hasReferer: false,
    getPlayer: function () {
      PlayerRules['tudou_portal'] = {
        object: FileIO.path + 'tudou.swf',
        remote: FileIO.link + 'tudou.swf',
        string: /http:\/\/js\.tudouui\.com\/bin\/lingtong\/PortalPlayer.*\.swf/i,
      };
      PlayerRules['tudou_olc'] = {
        object: 'http://js.tudouui.com/bin/player2/olc.swf',
        string: /http:\/\/js\.tudouui\.com\/bin\/player2\/olc.+\.swf/i,
      };
      PlayerRules['tudou_social'] = {
        object: FileIO.path + 'sp.swf',
        remote: FileIO.link + 'sp.swf',
        string: /http:\/\/js\.tudouui\.com\/bin\/lingtong\/SocialPlayer.*\.swf/i,
      };
    },
    setPlayer: function (aState) {
      RuleExecution.toggle(aState, PlayerRules['tudou_portal']);
      RuleExecution.toggle(aState, PlayerRules['tudou_olc']);
      RuleExecution.toggle(aState, PlayerRules['tudou_social']);
    },
    getFilter: function () {
      FilterRules['youku_tudou'] = {
        string: /http:\/\/val[fcopb]\.atm\.youku\.com\//i,
        mode: 0,
      };
    },
    setFilter: function (aState) {
      RuleExecution.toggle(aState, FilterRules['youku_tudou']);
    },
  },
  'iqiyi': {
    target: /http:\/\/www\.iqiyi\.com\/.+Player.+\.swf/i,
    url: /http:\/\/[^\/]+(iqiyi\.com)\//i,
    name: 'rule.iqiyi.defined',
    type: 'integer',
    value: 2,
    hasPlayer: true,
    hasFilter: true,
    hasReferer: true,
    referer: {
      name: 'referer.iqiyi.enabled',
      type: 'bool',
      value: true,
    },
    getPlayer: function () {
      PlayerRules['iqiyi5'] = {
        object: FileIO.path + 'iqiyi5.swf',
        remote: FileIO.link + 'iqiyi5.swf',
        string: /http:\/\/www\.iqiyi\.com\/common\/flashplayer\/\d+\/MainPlayer.*\.swf/i,
      };
      PlayerRules['iqiyi_out'] = {
        object: FileIO.path + 'iqiyi_out.swf',
        remote: FileIO.link + 'iqiyi_out.swf',
        string: /https?:\/\/www\.iqiyi\.com\/(common\/flash)?player\/\d+\/(Share|Enjoy)?Player.*\.swf/i,
      };
    },
    setPlayer: function (aState) {
      RuleExecution.toggle(aState, PlayerRules['iqiyi5']);
      RuleExecution.toggle(aState, PlayerRules['iqiyi_out']);
    },
    getFilter: function () {
      FilterRules['iqiyi'] = {
        string: /http:\/\/(\w+\.){3}\w+\/videos\/other\/\d+\/(\w{2}\/){2}\w{32}\.(f4v|hml)/i,
        mode: 0,
      };
      FilterRules['iqiyi_pause'] = {
        string: /http:\/\/www\.iqiyi\.com\/common\/flashplayer\/\d+\/(\w{32}|cornersign.+)\.swf/i,
        mode: 0,
      };
    },
    setFilter: function (aState) {
      RuleExecution.toggle(aState, FilterRules['iqiyi']);
      RuleExecution.toggle(aState, FilterRules['iqiyi_pause']);
    },
    getReferer: function () {
      RefererRules['referer-iqiyi'] = {
        object: 'http://www.iqiyi.com/',
        string: /http:\/\/.*\.qiyi\.com/i,
      };
    },
    setReferer: function (aState) {
      RuleExecution.toggle(aState, RefererRules['referer-iqiyi']);
    },
  },
  'letv': {
    target: /http:\/\/player\.letvcdn\.com\/.+player\.swf/i,
    url: /http:\/\/[^\/]+letv\.com\//i,
    name: 'rule.letv.defined',
    type: 'integer',
    value: 2,
    hasPlayer: true,
    hasFilter: true,
    hasReferer: false,
    getPlayer: function () {
      PlayerRules['letv'] = {
        object: FileIO.path + 'letv.swf',
        remote: FileIO.link + 'letv.swf',
        string: /http:\/\/.*\.letv(cdn)?\.com\/.*(new)?player\/((SDK)?Letv|swf)Player\.swf/i,
      };
      PlayerRules['letv_skin'] = {
        object: 'http://player.letvcdn.com/p/201407/24/15/newplayer/1/SSLetvPlayer.swf',
        string: /http:\/\/player\.letvcdn\.com\/p\/((?!15)\d+\/){3}newplayer\/1\/S?SLetvPlayer\.swf/i,
      };
    },
    setPlayer: function (aState) {
      RuleExecution.toggle(aState, PlayerRules['letv']);
      RuleExecution.toggle(aState, PlayerRules['letv_skin']);
    },
    getFilter: function () {
      FilterRules['letv'] = {
        string: /http:\/\/(ark|fz)\.letv\.com\//i,
        mode: 0,
      };
    },
    setFilter: function (aState) {
      RuleExecution.toggle(aState, FilterRules['letv']);
    },
  },
  'sohu': {
    target: /http:\/\/tv\.sohu\.com\/.+main\.swf/i,
    url: /http:\/\/(tv\.sohu|[^\/]+56)\.com\//i,
    name: 'rule.sohu.defined',
    type: 'integer',
    value: 2,
    hasPlayer: true,
    hasFilter: true,
    hasReferer: false,
    getPlayer: function () {
      PlayerRules['sohu'] = {
        object: FileIO.path + 'sohu_live.swf',
        remote: FileIO.link + 'sohu_live.swf',
        string: /http:\/\/(tv\.sohu\.com\/upload\/swf\/(p2p\/|56\/)?\d+|(\d+\.){3}\d+\/webplayer)\/Main\.swf/i,
      };
    },
    setPlayer: function (aState) {
      RuleExecution.toggle(aState, PlayerRules['sohu']);
    },
    getFilter: function () {
      FilterRules['sohu'] = {
        string: /http:\/\/v\.aty\.sohu\.com\/v\?/i,
        mode: 1,
      };
    },
    setFilter: function (aState) {
      RuleExecution.toggle(aState, FilterRules['sohu']);
    },
  },
  'pptv': {
    target: /http:\/\/player\.pplive\.cn\/.+(player|live).+\.swf/i,
    url: /http:\/\/[^\/]+pptv\.com\//i,
    name: 'rule.pptv.defined',
    type: 'integer',
    value: 2,
    hasPlayer: true,
    hasFilter: true,
    hasReferer: false,
    getPlayer: function () {
      PlayerRules['pptv'] = {
        object: FileIO.path + 'player4player2.swf',
        remote: FileIO.link + 'player4player2.swf',
        string: /http:\/\/player.pplive.cn\/ikan\/.*\/player4player2\.swf/i,
      };
    },
    setPlayer: function (aState) {
      RuleExecution.toggle(aState, PlayerRules['pptv']);
    },
    getFilter: function () {
      FilterRules['pptv'] = {
        string: /http:\/\/de\.as\.pptv\.com\/ikandelivery\/vast\/.+draft/i,
        mode: 0,
      };
    },
    setFilter: function (aState) {
      RuleExecution.toggle(aState, FilterRules['pptv']);
    },
  },
  'qq': {
    target: /http:\/\/imgcache\.qq\.com\/.+mediaplugin\.swf/i,
    url: /http:\/\/v\.qq\.com\//i,
    name: 'rule.qq.defined',
    type: 'integer',
    value: 2,
    hasPlayer: false,
    hasFilter: true,
    hasReferer: false,
    getFilter: function () {
      FilterRules['qq'] = {
        string: /http:\/\/livew\.l\.qq\.com\//i,
        mode: 0,
      };
    },
    setFilter: function (aState) {
      RuleExecution.toggle(aState, FilterRules['qq']);
    },
  },
  '163': {
    target: /http:\/\/v\.163\.com\/.+player.+\.swf/i,
    url: /http:\/\/v\.163\.com\//i,
    name: 'rule.163.defined',
    type: 'integer',
    value: 2,
    hasPlayer: false,
    hasFilter: true,
    hasReferer: false,
    getFilter: function () {
      FilterRules['163'] = {
        string: /http:\/\/v\.163\.com\/special\/.*\.xml/i,
        mode: 0,
      };
    },
    setFilter: function (aState) {
      RuleExecution.toggle(aState, FilterRules['163']);
    },
  },
  'sina': {
    target: /http:\/\/[^/]+\.sina\.com\.cn\/.+player.+\.swf/i,
    url: /http:\/\/video\.+sina\.com\.cn\//i,
    name: 'rule.sina.defined',
    type: 'integer',
    value: 2,
    hasPlayer: false,
    hasFilter: true,
    hasReferer: false,
    getFilter: function () {
      FilterRules['sina'] = {
        string: /http:\/\/sax\.sina\.com\.cn\//i,
        mode: 0,
      };
    },
    setFilter: function (aState) {
      RuleExecution.toggle(aState, FilterRules['sina']);
    },
  },
};

var PrefValue = {
  'autoupdate': {
    name: 'autoupdate.enabled',
    type: 'bool',
    value: false,
  },
  'lastdate': {
    name: 'autoupdate.lastdate',
    type: 'integer',
    value: parseInt(Date.now() / 1000),
  },
  'period': {
    name: 'autoupdate.period',
    type: 'integer',
    value: 7,
  },
  'remote': {
    name: 'remote.access.enabled',
    type: 'bool',
    value: false,
  },
  'override': {
    name: 'remote.override.enabled',
    type: 'bool',
    value: false,
  },
  'option': {
    name: 'file.directory.option',
    type: 'integer',
    value: 1,
  },
  'directory': {
    name: 'file.directory.defined',
    type: 'string',
    value: '',
  },
  'server': {
    name: 'remote.server.defined',
    type: 'string',
    value: '',
  },
  'bitbucket': {
    name: 'remote.server.bitbucket',
    type: 'string',
    value: 'https://bitbucket.org/kafan15536900/haoutil/raw/master/player/testmod/',
  },
  'toolbar': {
    name: 'general.interface.enabled',
    type: 'bool',
    value: true,
  },
  'firstrun': {
    name: 'general.firstrun.done',
    type: 'bool',
    value: false,
  },
};
var Preferences = {
  branch: Services.prefs.getBranch('extensions.sowatchmk2.'),
  getValue: function (aPref) {
    if (aPref.type == 'bool') {
      return this.branch.getBoolPref(aPref.name);
    }
    if (aPref.type == 'integer') {
      return this.branch.getIntPref(aPref.name);
    }
    if (aPref.type == 'string') {
      return this.branch.getComplexValue(aPref.name, Components.interfaces.nsISupportsString).data;
    }
  },
  setValue: function (aPref, aValue) {
    if (aValue == undefined) aValue = aPref.value;
    if (aPref.type == 'bool') {
      this.branch.setBoolPref(aPref.name, aValue);
    }
    if (aPref.type == 'integer') {
      this.branch.setIntPref(aPref.name, aValue);
    }
    if (aPref.type == 'string') {
      var aChar = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
      aChar.data = aValue;
      this.branch.setComplexValue(aPref.name, Components.interfaces.nsISupportsString, aChar);
    }
  },
  pending: function () {
    for (var i in PrefValue) {
      try {
        this.getValue(PrefValue[i]);
      } catch (e) {
        this.setValue(PrefValue[i]);
      }
    }

    this.setValue(PrefValue['bitbucket']);  // 禁止修改bitbucket否则会影响扩展工作

    if (this.getValue(PrefValue['period']) < 1 || this.getValue(PrefValue['period']) > 365) this.setValue(PrefValue['period']);

    if (this.getValue(PrefValue['option']) == 0) {
      if (this.getValue(PrefValue['directory'])) FileIO.extDir = this.getValue(PrefValue['directory']);
      else this.setValue(PrefValue['option']);
    } else if (this.getValue(PrefValue['option']) == 1) {
      FileIO.extDir = OS.Path.join(OS.Constants.Path.profileDir, 'soWatch');
    } else if (this.getValue(PrefValue['option']) == 2) {
      FileIO.extDir = OS.Path.join(OS.Constants.Path.libDir, 'browser', 'soWatch');
    } else if (this.getValue(PrefValue['option']) == 3) {
	  FileIO.extDir = OS.Path.join(OS.Constants.Path.homeDir, 'soWatch');
    } else {
      this.setValue(PrefValue['option']);
    }

    FileIO.path = OS.Path.toFileURI(FileIO.extDir) + '/';

    if (this.getValue(PrefValue['server'])) FileIO.server = this.getValue(PrefValue['server']);
    else this.setValue(PrefValue['override'], false);

    if (this.getValue(PrefValue['override'])) FileIO.link = FileIO.server;
    else FileIO.link = this.getValue(PrefValue['bitbucket']);

    if (this.getValue(PrefValue['autoupdate'])) {
      if (this.getValue(PrefValue['lastdate']) + this.getValue(PrefValue['period']) * 86400 < Date.now() / 1000) QueryFiles.start('no');
    }

    if (this.getValue(PrefValue['toolbar'])) Toolbar.addIcon();
    else Toolbar.removeIcon();

    this.manifest();

/** After rules are initialized, do the firstrun check
    仅在完全初始化所有规则后才检查是否是初次运行 */
    if (!this.getValue(PrefValue['firstrun'])) {
      QueryFiles.start('no');
      this.setValue(PrefValue['firstrun'], true);
    }
  },
/**  Minor tweak on pref > rule. If nothing special is required, There's need to tweak those codes.
     微调参数与规则间的关系。如果新加网站不需要特殊规则可以不管这部分代码  */
  manifest: function () {
    for (var i in SiteLists) {
      if (SiteLists[i].hasReferer) {
        try {
          this.getValue(SiteLists[i]['referer']);
        } catch (e) {
          this.setValue(SiteLists[i]['referer']);
        } finally {
          SiteLists[i].getReferer();
          if (this.getValue(SiteLists[i]['referer'])) SiteLists[i].setReferer('on')
          else SiteLists[i].setReferer('off');
        }
      }

      try {
        this.getValue(SiteLists[i]);
      } catch (e) {
        this.setValue(SiteLists[i]);
      } finally {
        if (SiteLists[i].hasPlayer) {
          SiteLists[i].getPlayer();
          if (this.getValue(SiteLists[i]) == 1) SiteLists[i].setPlayer('on');
          else SiteLists[i].setPlayer('off');
        } else {
          if (this.getValue(SiteLists[i]) == 1) this.setValue(SiteLists[i]);
        }

        if (SiteLists[i].hasFilter) {
          SiteLists[i].getFilter();
          if (this.getValue(SiteLists[i]) == 2) SiteLists[i].setFilter('on');
          else SiteLists[i].setFilter('off');
        } else {
          if (this.getValue(SiteLists[i]) == 2) this.setValue(SiteLists[i]);
        }
      }

      if (this.getValue(SiteLists[i]) > 2) this.setValue(SiteLists[i]);
    }

    for (var i in Adapter) {
      var aSite = Adapter[i]['site'];
      var aPref = Adapter[i]['pref'];

      for (var x in aSite) {
        for (var n in aSite) {
          if (x != n && aPref == 'player') {
            if ((this.getValue(SiteLists[aSite[x]]) == 1 && this.getValue(SiteLists[aSite[n]]) != 1) || (this.getValue(SiteLists[aSite[x]]) != 1 && this.getValue(SiteLists[aSite[n]]) == 1))
              this.setValue(SiteLists[aSite[n]], this.getValue(SiteLists[aSite[x]]));
          }
          if (x != n && aPref == 'filter') {
            if ((this.getValue(SiteLists[aSite[x]]) == 2 && this.getValue(SiteLists[aSite[n]]) == 0) || (this.getValue(SiteLists[aSite[x]]) == 0 && this.getValue(SiteLists[aSite[n]]) == 2))
              this.setValue(SiteLists[aSite[n]], this.getValue(SiteLists[aSite[x]]));
          }
        }
      }
    }
  },
  setDefault: function () {
    for (var i in PrefValue) {
      if (i == 'directory' || i == 'server' || i == 'firstrun') continue; // 这里是那些不受“恢复默认”功能限制的参数
      this.setValue(PrefValue[i]);
    }
    for (var i in SiteLists) {
      if (SiteLists[i].hasReferer) this.setValue(SiteLists[i]['referer']);
      this.setValue(SiteLists[i]);
    }
  },
  remove: function () {
    Services.prefs.deleteBranch('extensions.sowatchmk2.');
  },
};

var QueryFiles = {
  hash: function (aMode, aLink, aFile, aPref, aProbe) {
    if (!aProbe) aProbe = 0;
    if (aProbe <= 3) {
      aProbe = aProbe + 1;
      var aClient = Components.classes['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Components.interfaces.nsIXMLHttpRequest);
      aClient.open('HEAD', aLink, false);
      aClient.onload = function () {
        var aSize = new Number(aClient.getResponseHeader('Content-Length'));
        if (aSize < 5000) aClient.onerror();
        var aHash = aSize.toString(16);
        aLink = aClient.responseURL;
        if (aMode == 'no') QueryFiles.check(aLink, aFile, aPref, aHash);
        if (aMode == 'yes') QueryFiles.fetch(aLink, aFile, aPref, aHash);
      }
      aClient.onerror = function () {
        aClient.abort();
        QueryFiles.hash(aMode, aLink, aFile, aPref, aProbe);
      }
      aClient.send();
    } else return;
  },
  check: function (aLink, aFile, aPref, aHash) {
    try {
      var xHash = Preferences.getValue(aPref);
      if (xHash == aHash) return;
      else QueryFiles.fetch(aLink, aFile, aPref, aHash);
    } catch (e) {
      OS.File.stat(aFile).then(function onSuccess(aData) {
        var xSize = aData.size;
        var xHash = xSize.toString(16);
        if (xHash == aHash) Preferences.setValue(aPref, aHash);
        else QueryFiles.fetch(aLink, aFile, aPref, aHash);
      }, function onFailure(aReason) {
        if (aReason instanceof OS.File.Error && aReason.becauseNoSuchFile) {
          QueryFiles.fetch(aLink, aFile, aPref, aHash);
        }
      });
    }
  },
  fetch: function (aLink, aFile, aPref, aHash, aProbe) {
    if (!aProbe) aProbe = 0;
    if (aProbe <= 3) {
      aProbe = aProbe + 1;
      var aTemp = aFile + '_sw'; // 因为Downloads.jsm并不能直接覆盖原文件所以需要使用临时文件
      Downloads.fetch(aLink, aTemp, {isPrivate: true}).then(function onSuccess() {
        OS.File.move(aTemp, aFile);
        Preferences.setValue(aPref, aHash);
      }, function onFailure() {
        OS.File.remove(aTemp);
        QueryFiles.fetch(aLink, aFile, aPref, aHash, aProbe);
      });
    } else return;
  },
  start: function (aMode) {
    FileIO.addFolder();
    for (var i in PlayerRules) {
      if ('remote' in PlayerRules[i]) {
        var aLink = PlayerRules[i]['remote'];
        var aFile = OS.Path.fromFileURI(PlayerRules[i]['object']);
        var aPref = {
          name: 'file.hash.' + OS.Path.split(aFile).components[OS.Path.split(aFile).components.length - 1],
          type: 'string',
        };
        QueryFiles.hash(aMode, aLink, aFile, aPref);
      }
    }
    Preferences.setValue(PrefValue['lastdate']); // 下载完成后记录时间以供下次更新时检测
  },
};

var Toolbar = {
  css: Services.io.newURI('chrome://sowatchmk2/skin/toolbar.css', null, null),
  addIcon: function () {
    if (this.buttonOn) return;
    CustomizableUI.createWidget({
      id: 'sowatchmk2-button',
      type: 'custom',
      defaultArea: CustomizableUI.AREA_NAVBAR,
      onBuild: function (aDocument) {
        var aLists = {
          'default': {
            label: Utilities.GetStringFromName('setDefaultLabel'),
            tooltiptext: Utilities.GetStringFromName('setDefaultDescription'),
          },
          S1: null, // Menu separator
          'remote': {
            label: Utilities.GetStringFromName('remoteAccessLabel'),
            tooltiptext: Utilities.GetStringFromName('remoteAccessDescription'),
          },
          'autoupdate': {
            label: Utilities.GetStringFromName('autoUpdateLabel'),
            tooltiptext: Utilities.GetStringFromName('autoUpdateDescription'),
          },
          S2: null, // Menu separator
          'checkupdate': {
            label: Utilities.GetStringFromName('checkUpdateLabel'),
            tooltiptext: Utilities.GetStringFromName('checkUpdateDescription'),
          },
          'forceupdate': {
            label: Utilities.GetStringFromName('forceUpdateLabel'),
            tooltiptext: Utilities.GetStringFromName('forceUpdateDescription'),
          },
          S3: null, // Menu separator
        };

/**  If hasReferer is true, you must add menuitem label & tooltiptext separately
     如果新网站hasReferer设置为true，你需要按照下面格式单独添加菜单信息  */
        SiteLists['youku']['referer'].label = Utilities.GetStringFromName('youkuRefererLabel');
        SiteLists['youku']['referer'].tooltiptext = Utilities.GetStringFromName('youkuRefererDescription');
        SiteLists['iqiyi']['referer'].label = Utilities.GetStringFromName('iqiyiRefererLabel');
        SiteLists['iqiyi']['referer'].tooltiptext = Utilities.GetStringFromName('iqiyiRefererDescription');
/**  The sites listed in SiteLists, and menu label & tooltiptext.
     请在下面添加SiteLists中的网站的菜单信息。  */
        SiteLists['youku'].label = Utilities.GetStringFromName('youkuSiteLabel');
        SiteLists['youku'].tooltiptext = 'http://www.youku.com/';
        SiteLists['tudou'].label = Utilities.GetStringFromName('tudouSiteLabel');
        SiteLists['tudou'].tooltiptext = 'http://www.tudou.com/';
        SiteLists['iqiyi'].label = Utilities.GetStringFromName('iqiyiSiteLabel');
        SiteLists['iqiyi'].tooltiptext = 'http://www.iqiyi.com/';
        SiteLists['letv'].label = Utilities.GetStringFromName('letvSiteLabel');
        SiteLists['letv'].tooltiptext = 'http://www.letv.com/';
        SiteLists['sohu'].label = Utilities.GetStringFromName('sohuSiteLabel');
        SiteLists['sohu'].tooltiptext = 'http://tv.sohu.com/';
        SiteLists['pptv'].label = Utilities.GetStringFromName('pptvSiteLabel');
        SiteLists['pptv'].tooltiptext = 'http://www.pptv.com/';
        SiteLists['qq'].label = Utilities.GetStringFromName('qqSiteLabel');
        SiteLists['qq'].tooltiptext = 'http://v.qq.com/';
        SiteLists['163'].label = Utilities.GetStringFromName('163SiteLabel');
        SiteLists['163'].tooltiptext = 'http://v.163.com/';
        SiteLists['sina'].label = Utilities.GetStringFromName('sinaSiteLabel');
        SiteLists['sina'].tooltiptext = 'http://video.sina.com.cn/';

        var nLists = {
          'player': {
            label: Utilities.GetStringFromName('rulePlayerLabel'),
            tooltiptext: Utilities.GetStringFromName('rulePlayerDescription'),
          },
          'filter': {
            label: Utilities.GetStringFromName('ruleFilterLabel'),
            tooltiptext: Utilities.GetStringFromName('ruleFilterDescription'),
          },
          'none': {
            label: Utilities.GetStringFromName('ruleNoneLabel'),
            tooltiptext: Utilities.GetStringFromName('ruleNoneDescription'),
          },
        };

        var aMenu = aDocument.createElement('toolbarbutton');
        aMenu.setAttribute('id', 'sowatchmk2-button');
        aMenu.setAttribute('class', 'toolbarbutton-1');
        aMenu.setAttribute('type', 'menu');
        aMenu.setAttribute('label', 'soWatch! mk2');

        var aPopup = aDocument.createElement('menupopup');
        aPopup.setAttribute('id', 'sowatchmk2-popup');
        aPopup.addEventListener('click', this.onClick, false);
        aPopup.addEventListener('popupshowing', this.onPopup, false);
        aMenu.appendChild(aPopup);

        for (var i in aLists) {
          if (i.length < 3) {
            var aSeparator = aDocument.createElement('menuseparator');
            aPopup.appendChild(aSeparator);
          } else {
            var aItem = aDocument.createElement('menuitem');
            aItem.setAttribute('id', 'sowatchmk2-' + i);
            aItem.setAttribute('label', aLists[i].label);
            aItem.setAttribute('tooltiptext', aLists[i].tooltiptext);
            aItem.setAttribute('class', 'menuitem-iconic');
            if (i == 'remote') aItem.setAttribute('type', 'checkbox');
            aPopup.appendChild(aItem);
          }
        }

        for (var x in SiteLists) {
          if (SiteLists[x].hasReferer) {
            var rItem = aDocument.createElement('menuitem');
            rItem.setAttribute('id', 'sowatchmk2-referer-' + x);
            rItem.setAttribute('label', SiteLists[x]['referer'].label);
            rItem.setAttribute('tooltiptext', SiteLists[x]['referer'].tooltiptext);
            rItem.setAttribute('class', 'menuitem-iconic');
            rItem.setAttribute('type', 'checkbox');
            aPopup.appendChild(rItem);
          }

          var xItem = aDocument.createElement('menu');
          xItem.setAttribute('id', 'sowatchmk2-' + x);
          xItem.setAttribute('label', SiteLists[x].label);
          xItem.setAttribute('tooltiptext', SiteLists[x].tooltiptext);
          xItem.setAttribute('class', 'menu-iconic');
          aPopup.appendChild(xItem);

          var xPopup = aDocument.createElement('menupopup');
          xPopup.setAttribute('id', 'sowatchmk2-popup-' + x);
          xItem.appendChild(xPopup);

          for (var n in nLists) {
            var nItem = aDocument.createElement('menuitem');
            nItem.setAttribute('id', 'sowatchmk2-' + x + '-' + n);
            nItem.setAttribute('label', nLists[n].label);
            nItem.setAttribute('tooltiptext', nLists[n].tooltiptext);
            nItem.setAttribute('type', 'radio');
            nItem.setAttribute('name', x);
            if (!SiteLists[x].hasPlayer && n == 'player') nItem.setAttribute('disabled', 'true');
            if (!SiteLists[x].hasFilter && n == 'filter') nItem.setAttribute('disabled', 'true');
            xPopup.appendChild(nItem);
          }
        }

        return aMenu;
      },
      onClick: function (aEvent) {
        if (aEvent.target.id == 'sowatchmk2-default') Preferences.setDefault();

        if (aEvent.target.id == 'sowatchmk2-remote') {
          if (Preferences.getValue(PrefValue['remote'])) Preferences.setValue(PrefValue['remote'], false);
          else Preferences.setValue(PrefValue['remote'], true);
        }

        if (aEvent.target.id == 'sowatchmk2-autoupdate') {
          if (Preferences.getValue(PrefValue['autoupdate'])) Preferences.setValue(PrefValue['autoupdate'], false);
          else Preferences.setValue(PrefValue['autoupdate'], true);
        }

        if (aEvent.target.id == 'sowatchmk2-checkupdate') QueryFiles.start('no');

        if (aEvent.target.id == 'sowatchmk2-forceupdate') QueryFiles.start('yes');

        for (var x in SiteLists) {
          if (SiteLists[x].hasReferer) {
            if (aEvent.target.id == 'sowatchmk2-referer-' + x) {
              if (Preferences.getValue(SiteLists[x]['referer'])) Preferences.setValue(SiteLists[x]['referer'], false);
              else Preferences.setValue(SiteLists[x]['referer'], true);
            }
          }

          if (aEvent.target.id == 'sowatchmk2-' + x + '-player') {
            if (!SiteLists[x].hasPlayer) continue;
            Preferences.setValue(SiteLists[x], 1);
          }
          if (aEvent.target.id == 'sowatchmk2-' + x + '-filter') {
            if (!SiteLists[x].hasFilter) continue;
            Preferences.setValue(SiteLists[x], 2);
          }
          if (aEvent.target.id == 'sowatchmk2-' + x + '-none') Preferences.setValue(SiteLists[x], 0);
        }
      },
      onPopup: function (aEvent) {
        if (aEvent.target.id == 'sowatchmk2-popup') {
          if (Preferences.getValue(PrefValue['remote'])) aEvent.target.querySelector('#sowatchmk2-remote').setAttribute('checked', 'true');
          else aEvent.target.querySelector('#sowatchmk2-remote').setAttribute('checked', 'false');

          if (Preferences.getValue(PrefValue['autoupdate'])) aEvent.target.querySelector('#sowatchmk2-autoupdate').setAttribute('checked', 'true');
          else aEvent.target.querySelector('#sowatchmk2-autoupdate').setAttribute('checked', 'false');
        }

        for (var x in SiteLists) {
          if (aEvent.target.id == 'sowatchmk2-popup') {
            if (!SiteLists[x].url.test(aEvent.target.ownerDocument.defaultView.content.location.href) && !SiteLists[x].popup) {
              aEvent.target.querySelector('#sowatchmk2-' + x).setAttribute('hidden', 'true');
              if (SiteLists[x].hasReferer) aEvent.target.querySelector('#sowatchmk2-referer-' + x).setAttribute('hidden', 'true');
            } else {
              aEvent.target.querySelector('#sowatchmk2-' + x).setAttribute('hidden', 'false');
              if (SiteLists[x].hasReferer) aEvent.target.querySelector('#sowatchmk2-referer-' + x).setAttribute('hidden', 'false');
            }

            if (SiteLists[x].hasReferer) {
              if (Preferences.getValue(SiteLists[x]['referer'])) aEvent.target.querySelector('#sowatchmk2-referer-' + x).setAttribute('checked', 'true');
              else aEvent.target.querySelector('#sowatchmk2-referer-' + x).setAttribute('checked', 'false');
            }
          }

          if (aEvent.target.id == 'sowatchmk2-popup-' + x) {
            if (Preferences.getValue(SiteLists[x]) == 1) aEvent.target.querySelector('#sowatchmk2-' + x + '-player').setAttribute('checked', 'true');
            else if (Preferences.getValue(SiteLists[x]) == 2) aEvent.target.querySelector('#sowatchmk2-' + x + '-filter').setAttribute('checked', 'true');
            else if (Preferences.getValue(SiteLists[x]) == 0) aEvent.target.querySelector('#sowatchmk2-' + x + '-none').setAttribute('checked', 'true');
          }
        }
      },
    });
    Services.sss.loadAndRegisterSheet(this.css, Services.sss.AUTHOR_SHEET);
    this.buttonOn = true;
  },
  removeIcon: function () {
    if (!this.buttonOn) return;
    Services.sss.unregisterSheet(this.css, Services.sss.AUTHOR_SHEET);
    CustomizableUI.destroyWidget('sowatchmk2-button');
    this.buttonOn = false;
  },
  UserInterface: function (aSubject) {
    var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);

    var aVisitor = new HttpHeaderVisitor();
    httpChannel.visitResponseHeaders(aVisitor);
    if (!aVisitor.isFlash()) return;

    for (var i in SiteLists) {
      if (SiteLists[i]['target'] && SiteLists[i]['target'].test(httpChannel.URI.spec)) SiteLists[i]['popup'] = true;
      else SiteLists[i]['popup'] = false;
    }
  },
};

var RuleExecution = {
  toggle: function (aState, aRule) {
    if (aState == 'on') aRule['target'] = aRule['string'];
    if (aState == 'off') aRule['target'] = null;
  },
  getPlayer: function (remote, rule, callback) {
    if (remote) var aObject = rule['remote'];
    else var aObject = rule['object'];
    NetUtil.asyncFetch(aObject, function (inputStream, status) {
      var binaryOutputStream = Components.classes['@mozilla.org/binaryoutputstream;1'].createInstance(Components.interfaces.nsIBinaryOutputStream);
      var storageStream = Components.classes['@mozilla.org/storagestream;1'].createInstance(Components.interfaces.nsIStorageStream);
      var count = inputStream.available();
      var data = NetUtil.readInputStreamToString(inputStream, count);
        storageStream.init(512, count, null);
        binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));
        binaryOutputStream.writeBytes(data, count);
        rule['storageStream'] = storageStream;
        rule['count'] = count;
      if (typeof callback === 'function') {
        callback();
      }
    });
  },
  QueryInterface: function (aIID) {
    if (aIID.equals(Components.interfaces.nsISupports) || aIID.equals(Components.interfaces.nsIObserver)) return this;
    return Components.results.NS_ERROR_NO_INTERFACE;
  },
  referer: function (aSubject) {
    var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);

    for (var i in RefererRules) {
      if (RefererRules[i]['target'] && RefererRules[i]['target'].test(httpChannel.originalURI.spec)) {
        httpChannel.setRequestHeader('Referer', RefererRules[i]['host'], false);
      }
    }
  },
  filter: function (aSubject) {
    var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);

    for (var i in FilterRules) {
/** Implement https://github.com/jc3213/soWatch/issues/7 to solve filter for iqiyi
    装载 https://github.com/jc3213/soWatch/issues/7 以解决iqiyi的过滤规则问题 */
      if (SiteLists['iqiyi']['target'].test(httpChannel.URI.spec)) {
        this.iqiyi = 0;
      }

      if (FilterRules[i]['target'] && FilterRules[i]['target'].test(httpChannel.URI.spec)) {
  /** Minor tweak for https://github.com/jc3213/soWatch/issues/7
      针对 https://github.com/jc3213/soWatch/issues/7 进行小幅修改 */
        if (i == 'iqiyi') {
          if (this.iqiyi != 1) {
            httpChannel.cancel(Components.results.NS_BINDING_ABORTED);
          }
          this.iqiyi = this.iqiyi + 1;
        } else {
          if (FilterRules[i]['mode'] == 0) httpChannel.cancel(Components.results.NS_BINDING_ABORTED);
          if (FilterRules[i]['mode'] == 1) httpChannel.suspend();
        }
      }
    }
  },
  player: function (aSubject) {
    var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);

    var aVisitor = new HttpHeaderVisitor();
    httpChannel.visitResponseHeaders(aVisitor);
    if (!aVisitor.isFlash()) return;

    for (var i in PlayerRules) {
      var rule = PlayerRules[i];
      if (rule['target'] && rule['target'].test(httpChannel.URI.spec)) {
        var fn = this, args = Array.prototype.slice.call(arguments);
        if (typeof rule['preHandle'] === 'function') rule['preHandle'].apply(fn, args);
        if (!rule['storageStream'] || !rule['count']) {
          httpChannel.suspend();
          var remote = Preferences.getValue(PrefValue['remote']);
          this.getPlayer(remote, rule, function () {
            httpChannel.resume();
            if (typeof rule['callback'] === 'function') rule['callback'].apply(fn, args);
          });
        }
        var newListener = new TrackingListener();
        aSubject.QueryInterface(Components.interfaces.nsITraceableChannel);
        newListener.originalListener = aSubject.setNewListener(newListener);
        newListener.rule = rule;
        break;
      }
    }
  },
};

function TrackingListener() {
  this.originalListener = null;
  this.rule = null;
}
TrackingListener.prototype = {
  onStartRequest: function (aRequest, aContext) {
    this.originalListener.onStartRequest(aRequest, aContext);
  },
  onStopRequest: function (aRequest, aContext) {
    this.originalListener.onStopRequest(aRequest, aContext, Components.results.NS_OK);
  },
  onDataAvailable: function (aRequest, aContext) {
    this.originalListener.onDataAvailable(aRequest, aContext, this.rule['storageStream'].newInputStream(0), 0, this.rule['count']);
  }
}

function HttpHeaderVisitor() {
  this._isFlash = false;
}
HttpHeaderVisitor.prototype = {
  visitHeader: function (aHeader, aValue) {
    if (aHeader.indexOf('Content-Type') !== -1) {
      if (aValue.indexOf('application/x-shockwave-flash') !== -1) {
        this._isFlash = true;
      }
    }
  },
  isFlash: function () {
    return this._isFlash;
  }
}

var Observers = {
  observe: function (aSubject, aTopic, aData) {
    if (aTopic == 'nsPref:changed') {
      Preferences.pending();
    }
    if (aTopic == 'http-on-modify-request') {
      RuleExecution.referer(aSubject);
    }
    if (aTopic == 'http-on-examine-response') {
      Toolbar.UserInterface(aSubject);
      RuleExecution.filter(aSubject);
      RuleExecution.player(aSubject);
    }
  },
  startUp: function () {
    Preferences.branch.addObserver('', this, false);
    Services.obs.addObserver(this, 'http-on-examine-response', false);
    Services.obs.addObserver(this, 'http-on-modify-request', false);
  },
  shutDown: function () {
    Preferences.branch.removeObserver('', this);
    Services.obs.removeObserver(this, 'http-on-examine-response', false);
    Services.obs.removeObserver(this, 'http-on-modify-request', false);
  },
};

function startup(aData, aReason) {
  Utilities = Services.strings.createBundle('chrome://sowatchmk2/locale/global.properties?' + Math.random());
  Preferences.pending();
  Observers.startUp();
}

function shutdown(aData, aReason) {
  Toolbar.removeIcon();
  Observers.shutDown();
}

function install(aData, aReason) {}

function uninstall(aData, aReason) {
  if (aReason == ADDON_UNINSTALL) {
    FileIO.delFolder();
    Preferences.remove();
  }
}
