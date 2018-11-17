/**
* @nocollapse
* @extends {AutoContentScript}
* @final
*/
class CustomExtensionContent extends AutoContentScript {
	
	constructor() {
		super(); // useless, for closure compiler
	}
	
	static initialized() { // content script is linked to background, ready
		// no super call, override only
		trace(this.name, "custom init");
		//Observer.watch(document.body, {childList: true, subtree: true}, this.trackNavigation.bind(this));
		// type here
		
		Lazy.delay(function() {
			
			//var hlp = new xph().ctx(document).path("//div").group().textContains("hellftfso").or().textEquals("hello world !").close().firstResult();
			//trace(hlp);
			
			trace("click & type");
			
			var paths = [
				'//input[@id="search-query"]', 			// twitter
				'//input[@id="uh-search-box"]', 		// yahoo
				'//input[@aria-label="Search"]', 		// google
				'//input[@id="searchInput"]', 			// wikipedia
				'//input[@aria-label="search_bar"]', 	// qwant
				'//input[@placeholder="Search"]', 		// instagram
			];
			var searchfield = null;
			for(var i = 0, l = paths.length; i < l; i++) {
				searchfield = new xph().ctx(document).craft(paths[i]).firstResult();
				if(searchfield !== null) break;
			}
			if(searchfield === null) return trace("search field not found");
			
			
			
			
			this.click(searchfield, function(result) {
				this.type("helloworld", function() {
					this.press("\r", function() {
						trace("perform search");
					}.bind(this));
				}.bind(this));
			}.bind(this));
			
		}.bind(this), 1000);
		
		
	}
	
	static trackNavigation(trackid, item, element, mutationtype, mutation) {
		//trace(mutation);
	}
	
	static onUpdate(info) {
		return trace(info);
		if(info.hasOwnProperty("url")) {
			trace("url change");
		}
		if(info.hasOwnProperty("status") && info["status"] == "complete") {
			trace("page loaded");
		}
	}
	
	static fromBackground(type, message, callback) { // message from background script
		if(super.fromBackground(type, message, callback)) return true;
		
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
		
		//callback(); // ack to background, here or in async handler
		//return true; // to enable async callback
	}
	
	static onOpenPopup() { // called when popup is opened
		super.onOpenPopup(); // do not remove
		
		trace("custom popup open");
		// type here
	}
	
	static onClosePopup() { // called when popup is closed
		super.onClosePopup(); // do not remove
		
		trace("custom popup close");
		// type here
	}
	
}

liftoff(CustomExtensionContent); // do not remove