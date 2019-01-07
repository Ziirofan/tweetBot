/**
* @nocollapse
* @extends {AutoBackgroundScript}
* @final
*/
class CustomExtensionBackground extends AutoBackgroundScript {

	constructor() {
		super(); // useless, for closure compiler
	}

	static initialized() { // extension is ready
		// no super call, override only
		trace(this.name, "custom init");

		// type here

	}

	static onInstall() {
		super.onInstall();
		chrome.runtime.onInstalled.addListener((details) => {
    let parentItem = chrome.contextMenus.create({ /* On déclare le menu principal */
    'title': 'Lorem Pastum', /* On lui donne un libellé */
    'id': 'loremPastum', /* On lui donne un identifiant */
    'contexts': ['editable'] /* On liste les contextes dans lesquels notre menu doit s’afficher */
  });
  chrome.contextMenus.create({ /* On déclare un sous-menu */
    'title': 'Coller une phrase',
    'id': 'loremPastum-short', /* On lui donne un identifiant */
    'contexts': ['editable'], /* On précise le contexte d'affichage */
    'parentId': parentItem /* On indique le menu parent */
  });
  chrome.contextMenus.create({
    'title': 'Coller un paragraphe',
    'id': 'loremPastum-medium',
    'contexts': ['editable'],
    'parentId': parentItem
  });
  chrome.contextMenus.create({
    'title': 'Coller un long paragraphe',
    'id': 'loremPastum-large',
    'contexts': ['editable'],
    'parentId': parentItem
  });
});
		// type here
	}

	static onStartup() {
		super.onStartup();
		// type here
	}

	static register(tab) { // new tab matches extension handler
		super.register(tab); // do not remove

		// type here
	}

	static unregister(tabId) { // tab was closed, unregister
		super.unregister(tabId); // do not remove

		// type here
	}

	static fromContent(tabid, type, message, callback) { // message from content script
		if(super.fromContent(tabid, type, message, callback)) return true;

		//callback(); // ack to background, here or in async handler
		//return true; // to enable async callback
	}

	static fromWeb(tabid, type, message, callback) { // message from web script
		if(super.fromWeb(tabid, type, message, callback)) return true;

		//callback(); // ack to background, here or in async handler
		//return true; // to enable async callback
	}

	static fromPopup(type, message, callback) { // message from popup script
		if(super.fromPopup(type, message, callback)) return true;
		//toContent("string","fromPopu");

		callback(); // ack to background, here or in async handler
		return true; // to enable async callback
	}

	static onClosePopup() { // called when popup is closed

		trace("custom popup close");
		// type here
	}

	static onUpdateTab(tabid, info) { // called when handled tab is updated

		trace("custom update tab", tabid, info);
		// type here
	}

}

liftoff(CustomExtensionBackground); // do not remove
