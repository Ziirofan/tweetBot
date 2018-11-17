/**
* @nocollapse
* @extends {ExtensionWebScript}
* @final
*/
class CustomExtensionWeb extends ExtensionWebScript {
	
	static initialize() {
		
		this.extid = "jhmlknjignnppjjobobgmocbdeoaebjp"; // chrome extension id, required for webpage <=> extension communications
		
		super.initialize();
	}
	
	static initialized() { // web script is linked to background, ready
		super.initialized();
		
	}
	
	static fromBackground(type, message, callback) {
		if(super.fromBackground(type, message, callback)) return true;
		
		//callback(); // ack to background, here or in async handler
		//return true; // to enable async callback
	}
	
	static fromContent(tabid, type, message, callback) {
		if(super.fromContent(tabid, type, message, callback)) return true;
				
		//callback(); // ack to content, here or in async handler
		//return true; // to enable async callback
	}
	
	static fromPopup(type, message, callback) {
		if(super.fromPopup(type, message, callback)) return true;
		
		//callback(); // ack to popup, here or in async handler
		//return true; // to enable async callback
	}
	
}

liftoff(CustomExtensionWeb); // do not remove