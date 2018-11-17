window.onload = function(event) { liftoff(CustomExtensionPopup); }; // do not remove

/**
* @nocollapse
* @extends {ExtensionPopupScript}
* @final
*/
class CustomExtensionPopup extends ExtensionPopupScript {
	
	constructor() { // useless, for closure compiler
		super();// useless, for closure compiler
	}
	
	static initialized() { // popup open and ready
		// no super call, override only
		trace(this.name, "custom init");
		
		// type here
		
	}
	
	static onTabs(tabs, activeTab) { // tabs fetched
		super.onTabs(tabs, activeTab); // do not remove
		
		// type here
	}
	
	static fromBackground(type, message, callback) { // message from background script
		if(super.fromBackground(type, message, callback)) return true;
	
		//callback(); // ack to background, here or in async handler
		//return true; // to enable async callback
	}
	
	static fromContent(tabid, type, message, callback) { // message from content script
		if(super.fromContent(tabid, type, message, callback)) return true;
	
		//callback(); // ack to content, here or in async handler
		//return true; // to enable async callback
	}
	
	static fromWeb(tabid, type, message, callback) { // message from content script
		if(super.fromWeb(tabid, type, message, callback)) return true;
	
		//callback(); // ack to web, here or in async handler
		//return true; // to enable async callback
	}
	
}