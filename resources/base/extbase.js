/**
* ExtBase
* Nico Pr
* https://nicopr.fr/chromextensions
*
*
*
* classes :
*
* 	ExtensionScript : base class to set up messaging between content, background, and popup scripts
*
* 	ExtensionBackgroundScript : base background script, access chrome apis, relay messages
*
*	ExtensionContentScript : base extension script, injected in every page matching manifest url rules
*
*	ExtensionWebScript : base web script, injected in website execution context
*
*	ExtensionPopupScript : base popup script, extension settings UI (top right icon)
*
*
* Communications between background / content / web / popup scripts :
*
*	There are two ways to communicate : runtime and ports
*
*	runtime communications : messages are sent using chrome.runtime.sendMessage, chrome.tabs.sendMessage, window.postMessage
*	port communications : messages are sent through Port objects and relayed by the background script
*
*
*	Depending on the script, methods to send messages :
*
*		toBackground(type, message, callback, ...args)
*		toContent(tabid, type, message, callback, ...args)
*		toWeb(tabid, type, message, callback, ...args)
*		toPopup(type, message, callback, ...args)
*
*	methods to receive messages : override, no need to call super method
*		fromBackground(type, message, callback)
*		fromContent(tabid, type, message, callback)
*		fromWeb(tabid, type, message, callback)
*		fromPopup(type, message, callback)
*
*	overload arguments "...args" are passed back to callback method with the message result
*
*		example :
*			// in your background script :
*					this.toContent({tabId}, "myType", {my: "message"}, myCallback.bind(this), "overload0", 1, {over: "load2"});
*
*						// triggers "fromBackground" method defined in your extension content script
*							fromBackground(type, message, callback) {
*								console.log(type, "message from bg :", message); // "myType" message from bg : {my: "message"}
*								// some code
*								callback({some: "results"}); // fires callback method passed to "toContent" method in background script
*							}
*
*					myCallback(result, overload0, overload1, overload2) {
*						console.log(result); // {some: "results"}
*						console.log(overload0, overload1, overload2); // "overload0", 1, {over: "load2"}
*					}
*
*		!!! fromBackground method MUST return true if callback is needed, if it doesn't the callback will be fired with null result !!!
*			same goes for other receive methods : fromContent fromWeb fromPopup
*			if callback is not needed, just pass the message with no callback argument, base extension will handle the rest
*
*	painful runtime messaging :
*
*	Background :
*		- can send to content via chrome.tabs
*		- cannot send to web (window.postMessage), send through content (chrome.tabs > window.postMessage)
*		- can send to popup via chrome.runtime
*
*	Content :
*		- can send to background via chrome.runtime
*		- can send to web via window.postMessage (same sab only, send to other web script through background > content > window.postMessage)
*		- can send to popup via chrome.runtime
*
*	Web :
*		- can send to background via chrome.runtime
*		- cannot send to content (chrome.tabs), send through background (chrome.runtime > chrome.tabs)
*		- can send to popup via chrome.runtime
*
*	Popup :
*		- can send to background via chrome.runtime
*		- can send to content via chrome.tabs
*		- cannot send to web (window.postMessage), send through content (chrome.tabs > window.postMessage)

*/

const DEBUG = true; // true = verbose, false = be quiet + removes every line "if(DEBUG) trace || console.log" while compiling with closure

const COMM_MESSAGE = 0;
const COMM_PORT = 1;

const COMM_TYPE = COMM_PORT; // choose COMM_PORT || COMM_MESSAGE

const SCRIPT_BACKGROUND = 0;
const SCRIPT_CONTENT = 1;
const SCRIPT_POPUP = 2;
const SCRIPT_WEB = 3;

/**
* @nocollapse
*/
class PortBase {

	constructor() {
		this.acks = 0;
		this.callbacks = new Map();
	}

	toBackground(type, message, callback) {}

	toContent(tabid, type, message, callback) {}

	toWeb(tabid, type, message, callback) {}

	toPopup(type, message, callback) {}

	/**
	* @method ack: new ack number for async callback
	* @param {Function} callback: method called when async ack is received
	* @param {...*} var_args
	*/
	ack(callback, var_args) {
		this.callbacks.set(++this.acks, {"callback": callback || die, "args": Array.prototype.slice.call(arguments).slice(1)});
		return this.acks;
	}

	/**
	* @method callback: callback linked to ack number and origin script
	* @param {number} ack: ack number
	* @param {number} script: script origin
	* @param {number=} tabid: if script origin is content or web, tabid is needed
	* @param {...*} var_args
	*/
	callback(ack, script, tabid, var_args) {
		return function(result) {
			var params = {"ack": ack, "result": result};
			if(script == SCRIPT_BACKGROUND) return this.toBackground("ack", params, die);
			else if(script == SCRIPT_CONTENT) return this.toContent(tabid, "ack", params, die);
			else if(script == SCRIPT_WEB) return this.toWeb(tabid, "ack", params, die);
			else if(script == SCRIPT_POPUP) return this.toPopup("ack", params, die);
		}.bind(this);
	}

}

/**
* @nocollapse
* @extends {PortBase}
*/
class BackgroundPort extends PortBase {

	/**
	* @param onConnect:
	* @param onDisconnect:
	* @param onContentMessage:
	* @param onWebMessage:
	* @param onPopupMessage:
	*/
	constructor(onConnect, onDisconnect, onContentMessage, onWebMessage, onPopupMessage) {
		super();

		this.onConnect = onConnect || die;
		this.onDisconnect = onDisconnect || die;
		this.onContentMessage = onContentMessage || die;
		this.onWebMessage = onWebMessage || die;
		this.onPopupMessage = onPopupMessage || die;

		this.contentPorts = new Map();
		this.webPorts = new Map();
		this.popupPort = null;

		this.portConnectHandler = this.onPortConnect.bind(this);
		chrome.runtime.onConnect.addListener(this.portConnectHandler);
		this.externalPortConnectHandler = this.onExternalPortConnect.bind(this);
		chrome.runtime.onConnectExternal.addListener(this.externalPortConnectHandler);
	}

	/**
	* @method onPortConnect: port is connected
	* @param port: connected port object
	*/
	onPortConnect(port) {

		if(port["sender"]["id"] != chrome.runtime.id) {
			if(DEBUG) trace("extension", port["sender"]["id"], "not allowed"); // other exts not allowed to send port messages
			port.disconnect();
			return;
		}

		if(DEBUG) trace(port.name, "port connected");

		var infos = {"name": port["name"]};

		switch(port["name"]) {

			case "content":
				this.contentPorts.set(port["sender"]["tab"]["id"], port);
				this.toContent(port["sender"]["tab"]["id"], "tabid", port["sender"]["tab"]["id"], die);
				infos["tab"] = port["sender"]["tab"]["id"];
				this.toContentAll("handle", port["sender"]["tab"]["id"], die); // notify other content scripts
				break;

			case "popup":
				this.popupPort = port;
				break;

			default:
				if(DEBUG) return trace("unknown port", port);
				break;

		}

		port.onMessage.addListener(this.onPortMessage.bind(this));
		port.onDisconnect.addListener(this.onPortDisconnect.bind(this));

		this.onConnect(infos);
	}

	/**
	* @method onExternalPortConnect: external port is connected
	* @param port: connected port object
	*/
	onExternalPortConnect(port) {
		// external port, no check sender, website authorized in manifest "externally_connectable" // TODO : CHECK DOCS SECURITY
		if(DEBUG) trace(port.name, "port connected");

		var infos = {"name": port["name"]};

		switch(port["name"]) {

			case "web":
				this.webPorts.set(port["sender"]["tab"]["id"], port);
				this.toWeb(port["sender"]["tab"]["id"], "tabid", port["sender"]["tab"]["id"], die);
				infos["tab"] = port["sender"]["tab"]["id"];
				break;

		}

		port.onMessage.addListener(this.onPortMessage.bind(this));
		port.onDisconnect.addListener(this.onPortDisconnect.bind(this));

		this.onConnect(infos);
	}

	/**
	* @method onPortMessage: message from port
	* @param {Object} message:
	*/
	onPortMessage(message) {
		//if(DEBUG) trace("port message :", message);
		switch(message["dst"]) {

			case SCRIPT_BACKGROUND:
				if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
				else if(message["src"] == SCRIPT_CONTENT) return this.fromContent(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
				else if(message["src"] == SCRIPT_WEB) return this.fromWeb(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
				else if(message["src"] == SCRIPT_POPUP) return this.fromPopup(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
				//else trace("wtf is dis", message);
				break;

			case SCRIPT_CONTENT:
				if(this.contentPorts.has(message["ttab"])) this.contentPorts.get(message["ttab"]).postMessage(message);
				//else trace("no tab", message["ttab"], message["msg"]);
				break;

			case SCRIPT_WEB:
				if(this.webPorts.has(message["ttab"])) this.webPorts.get(message["ttab"]).postMessage(message);
				//else trace("no tab", message["ttab"], message["msg"]);
				break;

			case SCRIPT_POPUP:
				if(this.popupPort !== null) this.popupPort.postMessage(message);
				//else trace("no popup");
				break;

		}

	}

	/**
	* @method onPortDisconnect: port is disconnected
	* @param port:
	*/
	onPortDisconnect(port) {
		if(DEBUG) trace("port disconnected", port["name"]);

		var infos = {"name": port["name"]};

		if(port["name"] == "content") this.contentPorts.delete(port["sender"]["tab"]["id"]);
		else if(port["name"] == "web") this.webPorts.delete(port["sender"]["tab"]["id"]);
		else if(port["name"] == "popup") this.popupPort = null;

		this.onDisconnect(infos);
	}

	/**
	* @method toContent: send a message to content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {BackgroundPort}
	*/
	toContent(tabid, type, message, callback) {
		if(this.contentPorts.has(tabid)) this.contentPorts.get(tabid).postMessage(
			{
				"src": SCRIPT_BACKGROUND,
				"dst": SCRIPT_CONTENT,
				"type": type,
				"msg": message,
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3))
			}
		);
	}

	/**
	* @method toContentAll: send message to all handled content scripts
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	toContentAll(type, message, callback) {
		var args = Array.prototype.slice.call(arguments);
		this.contentPorts.forEach(function(port, tabid) {
			this.toContent.apply(this, [tabid].concat(args));
		}.bind(this));
	}

	/**
	* @method toWeb: send message to web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	toWeb(tabid, type, message, callback) {
		if(this.webPorts.has(tabid)) this.webPorts.get(tabid).postMessage(
			{
				"src": SCRIPT_BACKGROUND,
				"dst": SCRIPT_WEB,
				"type": type,
				"msg": message,
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3))
			}
		);
	}

	/**
	* @method toPopup: send message to popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	toPopup(type, message, callback) {
		if(this.popupPort !== null) this.popupPort.postMessage(
			{
				"src": SCRIPT_BACKGROUND,
				"dst": SCRIPT_POPUP,
				"type": type,
				"msg": message,
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(2))
			}
		);
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message);
		if(this.onContentMessage(tabid, type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message);
		if(this.onWebMessage(tabid, type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromPopup: received message from popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromPopup(type, message, callback) {
		//if(DEBUG) trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback)) {}
		else callback();
	}

}

/**
* @nocollapse
* @extends {PortBase}
*/
class ContentPort extends PortBase {

	constructor(onConnect, onBackgroundMessage, onContentMessage, onWebMessage, onPopupMessage, onHandle) {
		super();

		this.onConnect = onConnect || die;
		this.onBackgroundMessage = onBackgroundMessage || die;
		this.onContentMessage = onContentMessage || die;
		this.onWebMessage = onWebMessage || die;
		this.onPopupMessage = onPopupMessage || die;
		this.onHandle = onHandle || die;

		this.tabid = 0;

		this.port = chrome.runtime.connect({name: "content"});
		this.portMessageHandler = this.onPortMessage.bind(this);
		this.port.onMessage.addListener(this.portMessageHandler);
	}

	/**
	* @method onPortMessage: message from port
	* @param {Object} message:
	*/
	onPortMessage(message) {
		//if(DEBUG) trace("content port message :", message);
		if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
		else if(message["src"] == SCRIPT_BACKGROUND) this.fromBackground(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		else if(message["src"] == SCRIPT_CONTENT) this.fromContent(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_WEB) this.fromWeb(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_POPUP) this.fromPopup(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		//else trace("wtf is dis", message);
	}

	/**
	* @method toPort: sed a message to port
	* @param {number} target:
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	toPort(target, tabid, type, message, callback) {
		this.port.postMessage(
			{
				"src": SCRIPT_CONTENT,
				"dst": target,
				"type": type,
				"msg": message,
				"ftab": this.tabid,
				"ttab": tabid,
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(4))
			}
		);
	}

	/**
	* @method toBackground: send a message to background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentPort}
	*/
	toBackground(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_BACKGROUND, this.tabid].concat(Array.prototype.slice.call(arguments)));
	}

	/**
	* @method toContent: send a message to content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentPort}
	*/
	toContent(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_CONTENT, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}

	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	toWeb(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_WEB, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}

	toPopup(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_POPUP, this.tabid].concat(Array.prototype.slice.call(arguments)));
	}

	/**
	* @method fromBackground: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromBackground(type, message, callback) {
		//if(DEBUG) trace(type, "from background :", message);

		switch(type) {

			case "tabid":
				this.tabid = message;
				this.onConnect(this.tabid);
				return false;
				break;

			case "handle":
				this.onHandle(message);
				return false;
				break;

		}

		if(this.onBackgroundMessage(type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
		if(this.onContentMessage(tabid, type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
		if(this.onWebMessage(tabid, type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromPopup: received message from popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromPopup(type, message, callback) {
		//if(DEBUG) trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback)) {}
		else callback();
	}

}

/**
* @nocollapse
* @extends {PortBase}
*/
class WebPort extends PortBase {

	constructor(extid, onConnect, onBackgroundMessage, onContentMessage, onWebMessage, onPopupMessage) {
		super();

		this.extid = extid;

		this.onConnect = onConnect || die;
		this.onBackgroundMessage = onBackgroundMessage || die;
		this.onContentMessage = onContentMessage || die;
		this.onWebMessage = onWebMessage || die;
		this.onPopupMessage = onPopupMessage || die;

		this.tabid = 0;

		this.port = chrome.runtime.connect(this.extid, {name: "web"});
		this.portMessageHandler = this.onPortMessage.bind(this);
		this.port.onMessage.addListener(this.portMessageHandler);
	}

	/**
	* @method onPortMessage: message from port
	* @param {Object} message:
	*/
	onPortMessage(message) {
		//if(DEBUG) trace("web port message :", message);
		if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
		else if(message["src"] == SCRIPT_BACKGROUND) this.fromBackground(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		else if(message["src"] == SCRIPT_CONTENT) this.fromContent(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_WEB) this.fromWeb(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_POPUP) this.fromPopup(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		//else trace("wtf is dis", message);
	}

	/**
	* @method toPort: sed a message to port
	* @param {number} target:
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	toPort(target, tabid, type, message, callback) {
		this.port.postMessage(
			{
				"src": SCRIPT_WEB,
				"dst": target,
				"type": type,
				"msg": message,
				"ftab": this.tabid,
				"ttab": tabid,
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(4))
			}
		);
	}

	/**
	* @method toBackground: send a message to background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebPort}
	*/
	toBackground(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_BACKGROUND, this.tabid].concat(Array.prototype.slice.call(arguments)));
	}

	/**
	* @method toContent: send a message to content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebPort}
	*/
	toContent(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_CONTENT, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}

	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	toWeb(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_WEB, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}

	toPopup(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_POPUP, this.tabid].concat(Array.prototype.slice.call(arguments)));
	}

	/**
	* @method fromBackground: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromBackground(type, message, callback) {
		//if(DEBUG) trace(type, "from background :", message);
		switch(type) {

			case "tabid":
				this.tabid = message;
				this.onConnect(this.tabid);
				return false;
				break;

		}

		if(this.onBackgroundMessage(type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message, "tab", tabid);
		if(this.onContentMessage(tabid, type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
		if(this.onWebMessage(tabid, type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromPopup: received message from popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromPopup(type, message, callback) {
		//if(DEBUG) trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback)) {}
		else callback();
	}

}

/**
* @nocollapse
* @extends {PortBase}
*/
class PopupPort extends PortBase {

	constructor(onConnect, onBackgroundMessage, onContentMessage, onWebMessage) {
		super();

		this.onConnect = onConnect || die;
		this.onBackgroundMessage = onBackgroundMessage || die;
		this.onContentMessage = onContentMessage || die;
		this.onWebMessage = onWebMessage || die;

		this.port = chrome.runtime.connect({name: "popup"});
		this.portMessageHandler = this.onPortMessage.bind(this);
		this.port.onMessage.addListener(this.portMessageHandler);
	}

	/**
	* @method onPortMessage: message from port
	* @param {Object} message:
	*/
	onPortMessage(message) {
		//if(DEBUG) trace("port message :", message);
		if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
		else if(message["src"] == SCRIPT_BACKGROUND) this.fromBackground(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		else if(message["src"] == SCRIPT_CONTENT) this.fromContent(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_WEB) this.fromWeb(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		//else trace("wtf is dis", message);
	}

	/**
	* @method toPort: sed a message to port
	* @param {number} target:
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	toPort(target, tabid, type, message, callback) {
		this.port.postMessage(
			{
				"src": SCRIPT_POPUP,
				"dst": target,
				"type": type,
				"msg": message,
				"ftab": 0,
				"ttab": tabid,
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(4))
			}
		);
	}

	/**
	* @method toBackground: send a message to background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {PopupPort}
	*/
	toBackground(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_BACKGROUND, 0].concat(Array.prototype.slice.call(arguments)));
	}

	/**
	* @method toContent: send a message to content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {PopupPort}
	*/
	toContent(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_CONTENT, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}

	toWeb(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_WEB, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}

	/**
	* @method fromBackground: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromBackground(type, message, callback) {
		//if(DEBUG) trace(type, "from background :", message);
		if(this.onBackgroundMessage(type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message, "tab", tabid);
		if(this.onContentMessage(tabid, type, message, callback)) {}
		else callback();
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
		if(this.onWebMessage(tabid, type, message, callback)) {}
		else callback();
	}

}

/**
* @nocollapse
*/
class MessageBase {

	constructor() {

		this.acks = 0;
		this.callbacks = new Map();

	}

	toBackground(type, message, callback) {}

	toContent(tabid, type, message, callback) {}

	toWeb(tabid, type, message, callback) {}

	toPopup(type, message, callback) {}

	/**
	* @method toruntime: send message to chrome runtime
	* @param {string} extid:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	toruntime(extid, message, callback) {
		callback = callback || die;
		chrome.runtime.sendMessage(extid, message, this.callbackLayer.apply(this, Array.prototype.slice.call(arguments).slice(2)));
	}

	/**
	* @method toruntime: send message to a tab
	* @param {number} tabid:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	totab(tabid, message, callback) {
		callback = callback || die;
		chrome.tabs.sendMessage(tabid, message, this.callbackLayer.apply(this, Array.prototype.slice.call(arguments).slice(2)));
	}

	/**
	* @method towindow: post message to window
	* @param {Object} message:
	*/
	towindow(message) {
		window.postMessage(message, window.location.toString());
	}

	/**
	* @method callback: allow user to pass any number of arguments to the async chrome callback executed after sending a message
	* @param {Function} callback:
	*/
	callbackLayer(callback) { // callback + any number of args
		var args = Array.prototype.slice.call(arguments); // keep ref for anonym nested method
		callback = callback || die; // or die
		return function(result) { // from chrome.tabs.sendMessage / chrome.runtime.sendMessage
			callback.apply(this, [result].concat(args.slice(1))); // exec callback(chromeResult, arg, ...)
		};
	}

	/**
	* @method ack: new ack number for async callback
	* @param {Function} callback: method called when async ack is received
	* @param {...*} var_args
	*/
	ack(callback, var_args) {
		this.callbacks.set(++this.acks, {"callback": callback || die, "args": Array.prototype.slice.call(arguments).slice(1)});
		return this.acks;
	}

	/**
	* @method callback: callback linked to ack number and origin script
	* @param {number} ack: ack number
	* @param {number} script: script origin
	* @param {number=} tabid: if script origin is content or web, tabid is needed
	* @param {...*} var_args
	*/
	callback(ack, script, tabid, var_args) {
		return function(result) {
			var params = {"ack": ack, "result": result};
			if(script == SCRIPT_BACKGROUND) return this.toBackground("ack", params, die);
			else if(script == SCRIPT_CONTENT) return this.toContent(tabid, "ack", params, die);
			else if(script == SCRIPT_WEB) return this.toWeb(tabid, "ack", params, die);
			else if(script == SCRIPT_POPUP) return this.toPopup("ack", params, die);
		}.bind(this);
	}

}

/**
* @nocollapse
* @extends {MessageBase}
*/
class BackgroundMessage extends MessageBase {

	constructor(onConnect, onContentMessage, onWebMessage, onPopupMessage) {
		super();

		if(DEBUG) trace("init background message");

		this.onConnect = onConnect;
		this.onContentMessage = onContentMessage;
		this.onWebMessage = onWebMessage;
		this.onPopupMessage = onPopupMessage;

		this.messageHandler = this.onMessage.bind(this);
		chrome.runtime.onMessage.addListener(this.messageHandler);

		this.externalMessageHandler = this.onMessageExternal.bind(this);
		chrome.runtime.onMessageExternal.addListener(this.externalMessageHandler);

	}

	/**
	* @method onMessage: received message
	* @param {Object} message:
	* @param sender:
	* @param {Function} callback:
	* @this {BackgroundMessage}
	*/
	onMessage(message, sender, callback) {
		//if(DEBUG) trace(message);
		if(chrome.runtime.id != sender["id"]) return; // other exts not allowed to send messages !!
		switch(message["dst"]) {

			case SCRIPT_BACKGROUND:
				if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
				else if(message["src"] == SCRIPT_CONTENT) return this.fromContent(sender["tab"]["id"], message["type"], message["msg"], callback);
				else if(message["src"] == SCRIPT_POPUP) return this.fromPopup(message["type"], message["msg"], callback);
				break;

		}
		return false; // RETURN TRUE TO ENABLE ASYNC CALLBACK
	}

	onMessageExternal(message, sender, callback) {
		//if(DEBUG) trace("external message", message);

		switch(message["dst"]) {

			case SCRIPT_BACKGROUND:
				if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
				else if(message["src"] == SCRIPT_WEB) return this.fromWeb(sender["tab"]["id"], message["type"], message["msg"], callback);
				break;

			case SCRIPT_CONTENT:
				this.totab.apply(this, [sender["tab"]["id"], {"src": message["src"], "dst": message["dst"], "type": message["type"], "msg": message["msg"], "ftab": sender["tab"]["id"], "ttab": message["ttab"]}, callback]);
				return true; // relay, must return true ??
				break;

			case SCRIPT_POPUP:
				this.toruntime.apply(this, ["", {"src": message["src"], "dst": message["dst"], "type": message["type"], "msg": message["msg"], "ftab": sender["tab"]["id"]}, callback]);
				return true; // relay, must return true ??
				break;

		}

		return true; // RETURN TRUE TO ENABLE ASYNC CALLBACK
	}

	/**
	* @method toContent: send message to content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {BackgroundMessage}
	*/
	toContent(tabid, type, message, callback) {
		this.totab.apply(this,
			[
				tabid,
				{
					"src": SCRIPT_BACKGROUND,
					"dst": SCRIPT_CONTENT,
					"type": type,
					"msg": message
				}, callback || die
			].concat(Array.prototype.slice.call(arguments).slice(4)) // callback || die !!
		);
	}

	/**
	* @method toWeb: send message to web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {BackgroundMessage}
	*/
	toWeb(tabid, type, message, callback) {
		this.totab.apply(this,
			[
				tabid,
				{
					"src": SCRIPT_BACKGROUND,
					"dst": SCRIPT_WEB,
					"type": type,
					"msg": message,
					"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3)) // callback || die !!
				},
				die
			]
		);
	}

	/**
	* @method toPopup: send message to popup
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {BackgroundMessage}
	*/
	toPopup(type, message, callback) {
		this.toruntime.apply(this,
			[
				"",
				{
					"src": SCRIPT_BACKGROUND,
					"dst": SCRIPT_POPUP,
					"type": type,
					"msg": message
				}, callback || die
			].concat(Array.prototype.slice.call(arguments).slice(3)) // callback || die !!
		);
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {BackgroundMessage}
	*/
	fromContent(tabid, type, message, callback) {
		//trace(type, "from content :", message);

		switch(type) {

			case "ehlo":
				callback(tabid);
				this.onConnect({"name": "content", "tab": tabid});
				return false;
				break;

		}

		if(this.onContentMessage(tabid, type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {BackgroundMessage}
	*/
	fromWeb(tabid, type, message, callback) {
		//trace(type, "from web :", message);

		switch(type) {

			case "ehlo":
				callback(tabid);
				this.onConnect({"name": "web", "tab": tabid});
				return;
				break;

		}

		if(this.onWebMessage(tabid, type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromPopup: received message from popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {BackgroundMessage}
	*/
	fromPopup(type, message, callback) {
		//trace(type, "from popup :", message);

		switch(type) {

			case "ehlo":
				callback();
				this.onConnect({"name": "popup"});
				return;
				break;

		}

		if(this.onPopupMessage(type, message, callback)) return true;
		else callback();
	}

}

/**
* @nocollapse
* @extends {MessageBase}
*/
class ContentMessage extends MessageBase {

	constructor(onConnect, onBackgroundMessage, onContentMessage, onWebMessage, onPopupMessage, onHandle) {
		super();

		if(DEBUG) trace("init content message");

		this.tabid = 0;

		this.onConnect = onConnect;
		this.onBackgroundMessage = onBackgroundMessage;
		this.onWebMessage = onWebMessage;
		this.onContentMessage = onContentMessage;
		this.onPopupMessage = onPopupMessage;
		this.onHandle = onHandle;

		this.messageHandler = this.onMessage.bind(this);
		chrome.runtime.onMessage.addListener(this.messageHandler);

		this.toBackground("ehlo", {}, this.helo.bind(this));
	}

	/**
	* @method helo: background script connected
	* @param {number} tabid:
	* @this {ContentMessage}
	*/
	helo(tabid) {
		this.tabid = tabid;
		this.onConnect(tabid);
	}

	/**
	* @method onMessage: received message
	* @param {Object} message:
	* @param sender:
	* @param {Function} callback:
	* @this {ContentMessage}
	*/
	onMessage(message, sender, callback) {
		if(chrome.runtime.id != sender.id) return; // other exts not allowed to send messages !!

		switch(message["dst"]) {

			case SCRIPT_CONTENT:
				if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
				else if(message["src"] == SCRIPT_BACKGROUND) return this.fromBackground(message["type"], message["msg"], callback);
				else if(message["src"] == SCRIPT_CONTENT) return this.fromContent(message["ftab"], message["type"], message["msg"], callback);
				else if(message["src"] == SCRIPT_WEB) return this.fromWeb(message["ftab"], message["type"], message["msg"], callback);
				else if(message["src"] == SCRIPT_POPUP) return this.fromPopup(message["type"], message["msg"], callback);
				//else trace("wtf is dis", event["data"]);
				break;

			case SCRIPT_WEB:
				this.towindow({"src": message["src"], "dst": SCRIPT_WEB, "type": message["type"], "msg": message["msg"], "ack": message["ack"]});
				break;
		}


		return false; // RETURN TRUE TO ENABLE ASYNC CALLBACK
	}

	/**
	* @method toBackground: send a message to background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentMessage}
	*/
	toBackground(type, message, callback) {
		this.toruntime.apply(this,
			[
				"",
				{
					"src": SCRIPT_CONTENT,
					"dst": SCRIPT_BACKGROUND,
					"type": type,
					"msg": message
				}, callback || die
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}

	/**
	* @method toPopup: send a message to popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentMessage}
	*/
	toPopup(type, message, callback) {
		this.toruntime.apply(this,
			[
				"",
				{
					"src": SCRIPT_CONTENT,
					"dst": SCRIPT_POPUP,
					"type": type,
					"msg": message,
					"ftab": this.tabid
				},
				callback || die
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}

	/**
	* @method toContent: send a message to content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentMessage}
	*/
	toContent(tabid, type, message, callback) {
		this.toruntime.apply(this,
			[
				"",
				{
					"src": SCRIPT_CONTENT,
					"dst": SCRIPT_CONTENT,
					"type": type,
					"msg": message,
					"ftab": this.tabid,
					"ttab": tabid
				},
				callback || die
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}

	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentMessage}
	*/
	toWeb(tabid, type, message, callback) {
		// if tabid != this.tabid, pipe to corresponding content tab id and then to window
		this.towindow.apply(this,
			[
				{
					"src": SCRIPT_CONTENT,
					"dst": SCRIPT_WEB,
					"type": type,
					"msg": message,
					"ftab": this.tabid,
					"ttab": tabid,
					"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3))
				}
			]
		);
	}

	/**
	* @method fromBackground: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentMessage}
	*/
	fromBackground(type, message, callback) {
		//trace(type, "from background :", message);
		if(this.onBackgroundMessage(type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentMessage}
	*/
	fromContent(tabid, type, message, callback) {
		//trace(type, "from content :", message);
		if(this.onContentMessage(tabid, type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentMessage}
	*/
	fromWeb(tabid, type, message, callback) {
		//trace(type, "from web :", message);
		if(this.onWebMessage(tabid, type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromPopup: received message from popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {ContentMessage}
	*/
	fromPopup(type, message, callback) {
		//trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback)) return true;
		else callback();
	}

}

/**
* @nocollapse
* @extends {MessageBase}
*/
class WebMessage extends MessageBase {

	constructor(extid, onConnect, onBackgroundMessage, onContentMessage, onWebMessage, onPopupMessage) {
		super();

		if(DEBUG) trace("init web message");

		this.extid = extid;
		this.tabid = 0;

		this.onConnect = onConnect;
		this.onBackgroundMessage = onBackgroundMessage;
		this.onContentMessage = onContentMessage;
		this.onWebMessage = onWebMessage;
		this.onPopupMessage = onPopupMessage;

		window.addEventListener("message", this.onWindowPostMessage.bind(this), false);

		this.toBackground("ehlo", {}, this.ehlo.bind(this));
	}

	ehlo(tabid) {
		this.tabid = tabid;
		this.onConnect(tabid);
	}

	onWindowPostMessage(event) {
		if(event["data"]["type"] == "ack") return this.callbacks.get(event["data"]["msg"]["ack"])["callback"].apply(this, [event["data"]["msg"]["result"]].concat(this.callbacks.get(event["data"]["msg"]["ack"])["args"]));
		else if(event["data"]["src"] == SCRIPT_BACKGROUND) this.fromBackground(event["data"]["type"], event["data"]["msg"], this.callback(event["data"]["ack"], event["data"]["src"]));
		else if(event["data"]["src"] == SCRIPT_CONTENT) this.fromContent(event["data"]["ftab"], event["data"]["type"], event["data"]["msg"], this.callback(event["data"]["ack"], event["data"]["src"], event["data"]["ftab"]));
		else if(event["data"]["src"] == SCRIPT_WEB) this.fromWeb(event["data"]["ftab"], event["data"]["type"], event["data"]["msg"], this.callback(event["data"]["ack"], event["data"]["src"], event["data"]["ftab"]));
		else if(event["data"]["src"] == SCRIPT_POPUP) this.fromPopup(event["data"]["type"], event["data"]["msg"], this.callback(event["data"]["ack"], event["data"]["src"]));
		//else trace("wtf is dis", event["data"]);
	}

	/**
	* @method toBackground: send a message to background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebMessage}
	*/
	toBackground(type, message, callback) {
		this.toruntime.apply(this,
			[
				this.extid,
				{
					"src": SCRIPT_WEB,
					"dst": SCRIPT_BACKGROUND,
					"type": type,
					"msg": message,
					"ftab": this.tabid
				},
				callback || die
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}

	/**
	* @method toContent: send a message to content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebMessage}
	*/
	toContent(tabid, type, message, callback) {
		this.toruntime.apply(this,
			[
				this.extid,
				{
					"src": SCRIPT_WEB,
					"dst": SCRIPT_CONTENT,
					"type": type,
					"msg": message,
					"ftab": this.tabid,
					"ttab": tabid
				},
				callback || die
			].concat(Array.prototype.slice.call(arguments).slice(4))
		);
	}

	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebMessage}
	*/
	toWeb(tabid, type, message, callback) {
		this.toruntime.apply(this,
			[
				this.extid,
				{
					"src": SCRIPT_WEB,
					"dst": SCRIPT_WEB,
					"type": type,
					"msg": message,
					"ftab": this.tabid,
					"ttab": tabid
				},
				callback || die
			].concat(Array.prototype.slice.call(arguments).slice(4))
		);
	}

	/**
	* @method toPopup: send message to popup
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebMessage}
	*/
	toPopup(type, message, callback) {
		this.toruntime.apply(this,
			[
				this.extid,
				{
					"src": SCRIPT_WEB,
					"dst": SCRIPT_POPUP,
					"type": type,
					"msg": message,
					"ftab": this.tabid
				},
				callback || die
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}

	/**
	* @method fromBackground: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebMessage}
	*/
	fromBackground(type, message, callback) {
		//trace(type, "from background :", message);
		if(this.onBackgroundMessage(type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebMessage}
	*/
	fromContent(tabid, type, message, callback) {
		//trace(type, "from content :", message);
		if(this.onContentMessage(tabid, type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebMessage}
	*/
	fromWeb(tabid, type, message, callback) {
		//trace(type, "from web :", message);
		if(this.onWebMessage(tabid, type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromPopup: received message from popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {WebMessage}
	*/
	fromPopup(type, message, callback) {
		//trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback)) return true;
		else callback();
	}

}

/**
* @nocollapse
* @extends {MessageBase}
*/
class PopupMessage extends MessageBase {

	constructor(onConnect, onBackgroundMessage, onContentMessage, onWebMessage) {
		super();

		if(DEBUG) trace("init popup message");

		this.onConnect = onConnect;
		this.onBackgroundMessage = onBackgroundMessage;
		this.onContentMessage = onContentMessage;
		this.onWebMessage = onWebMessage;

		this.messageHandler = this.onMessage.bind(this);
		chrome.runtime.onMessage.addListener(this.messageHandler);

		this.toBackground("ehlo", {}, this.ehlo.bind(this));
	}

	ehlo() {
		this.onConnect();
	}

	/**
	* @method onMessage: received message
	* @param {Object} message:
	* @param sender:
	* @param {Function} callback:
	* @this {PopupMessage}
	*/
	onMessage(message, sender, callback) {
		//trace(message);
		if(chrome.runtime.id != sender.id) return;
		if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
		if(message["dst"] == SCRIPT_POPUP && message["src"] == SCRIPT_BACKGROUND) return this.fromBackground(message["type"], message["msg"], callback);
		else if(message["dst"] == SCRIPT_POPUP && message["src"] == SCRIPT_CONTENT) return this.fromContent(sender["tab"]["id"], message["type"], message["msg"], callback);
		else if(message["dst"] == SCRIPT_POPUP && message["src"] == SCRIPT_WEB) return this.fromWeb(message["ftab"], message["type"], message["msg"], callback);
		return false; // RETURN TRUE TO ENABLE ASYNC CALLBACK
	}

	/**
	* @method toBackground: send a message to background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {PopupMessage}
	*/
	toBackground(type, message, callback) {
		var args = Array.prototype.slice.call(arguments);
		this.toruntime.apply(this,
			[
				"",
				{
					"src": SCRIPT_POPUP,
					"dst": SCRIPT_BACKGROUND,
					"type": type,
					"msg": message
				},
				callback || die
			].concat(args.slice(3))
		);
	}

	/**
	* @method toContent: send a message to content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {PopupMessage}
	*/
	toContent(tabid, type, message, callback) {
		this.totab.apply(this,
			[
				tabid,
				{
					"src": SCRIPT_POPUP,
					"dst": SCRIPT_CONTENT,
					"type": type,
					"msg": message
				},
				callback || die
			].concat(Array.prototype.slice.call(arguments).slice(4))
		);
	}

	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {PopupMessage}
	*/
	toWeb(tabid, type, message, callback) {
		this.totab.apply(this,
			[
				tabid,
				{
					"src": SCRIPT_POPUP,
					"dst": SCRIPT_WEB,
					"type": type,
					"msg": message,
					"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3))
				},
				die
			]
		);
	}

	/**
	* @method fromBackground: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {PopupMessage}
	*/
	fromBackground(type, message, callback) {
		//trace(type, "from background :", message);
		if(this.onBackgroundMessage(type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {PopupMessage}
	*/
	fromContent(tabid, type, message, callback) {
		//trace(type, "from content :", message);
		if(this.onContentMessage(tabid, type, message, callback)) return true;
		else callback();
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	* @this {PopupMessage}
	*/
	fromWeb(tabid, type, message, callback) {
		//trace(type, "from web :", message);
		if(this.onWebMessage(tabid, type, message, callback)) return true;
		else callback();
	}

}

/**
* @nocollapse
*/
class ExtensionScript { // don't touch or call

	constructor() {} // useless, for closure compiler

	static initialize() {
		console.log(whereami() + " script initializing");

	}

	/**
	* @method store: store key/value pair in local storage
	* @param {string} key:
	* @param value:
	* @param {Function} callback:
	*/
	static store(key, value, callback) {
		chrome.storage.sync.set({[key]: value}, callback);
	}

	/**
	* @method restore: fetch key/value pair from local storage
	* @param keys: string or array of srings
	* @param {Function} callback:
	*/
	static restore(keys, callback) {
		if(!(keys instanceof Array)) keys = [keys];
		chrome.storage.sync.get(keys, callback);
	}

}

/**
* @nocollapse
* @extends {ExtensionScript}
*/
class ExtensionBackgroundScript extends ExtensionScript {

	constructor() {
		super(); // useless, for closure compiler
	}

	static initialize() {
		super.initialize();

		this.installHandler = this.onInstall.bind(this);
		chrome.runtime.onInstalled.addListener(this.installHandler);

		this.startupHandler = this.onStartup.bind(this);
		chrome.runtime.onStartup.addListener(this.startupHandler);

		this.closeTabHandler = this.onCloseTab.bind(this);
		chrome.tabs.onRemoved.addListener(this.closeTabHandler);

		this.tabUpdateHandler = this.onTabUpdate.bind(this);
		chrome.tabs.onUpdated.addListener(this.tabUpdateHandler);

		this.tabs = new Map();

		if(COMM_TYPE == COMM_PORT) this.comm = new BackgroundPort(this.onCommConnect.bind(this), this.onPortDisconnect.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this));
		if(COMM_TYPE == COMM_MESSAGE) this.comm = new BackgroundMessage(this.onCommConnect.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this));

		this.initialized();
	}

	/**
	* @public
	* @method initialized: callback, script is ready
	*/
	static initialized() {
		if(DEBUG) trace(this.name, "initialized");

	}

	/**
	* @method onCommConnect:
	* @param {Object} infos:
	*/
	static onCommConnect(infos) {
		switch(infos["name"]) {

			case "content":
				this.register(infos["tab"]);
				break;

			case "web":

				break;

			case "popup":
				// TODO : if COMM_MESSAGE setInterval check getViews for popup close event // trace(chrome.extension.getViews({"type": "popup"}));
				this.onOpenPopup();
				break;


		}
	}

	/**
	* @method onPortDisconnect: port disconnected
	* @param infos:
	*/
	static onPortDisconnect(infos) {

		switch(infos["name"]) {

			case "content":

				break;

			case "popup":
				this.onClosePopup();
				break;

			case "web":

				break;

			default:
				break;

		}

	}

	/**
	* @method onTabUpdate: tab is updated
	* @param {number} tabid:
	* @param info:
	* @param tab:
	*/
	static onTabUpdate(tabid, info, tab) {
		if(this.tabs.has(tabid)) { // matched tabs only
			this.comm.toContent(tabid, "update", info, die);
			this.onUpdateTab(tabid, info);
		}
	}

	static onUpdateTab(tabid, info) {

	}

	/**
	* @public
	* dispatched on install && reload ext
	*/
	static onInstall() {

		trace("installed");

	}

	/**
	* @public
	* dispatched on chrome startup
	*/
	static onStartup() {
		trace("startup");

	}

	/**
	* @public
	* @method register: register new tab
	* @param {number} tabid:
	*/
	static register(tabid) {
		if(DEBUG) trace("register tab", tabid);
		this.tabs.set(tabid, {});
	}

	/**
	* @public
	* @method unregister: unregister tab
	* @param {number} tabid:
	*/
	static unregister(tabid) {
		if(DEBUG) trace("unregister tab", tabid);
		this.tabs.delete(tabid);
	}

	/**
	* @public
	* @method onCloseTab: handled tab closed
	* @param {number} tabid:
	* @param info:
	*/
	static onCloseTab(tabid, info) {
		if(DEBUG) trace("close tab", tabid, info);
		if(this.tabs.has(tabid)) this.unregister(tabid);
	}

	static onOpenPopup() {
		this.tabs.forEach(function(tab, tabid) { this.comm.toContent(tabid, "open", {}, die); }.bind(this));
		this.activeTab(this.popupState.bind(this));
		var option = chrome.runtime.openOptionsPage();
	}

	static onClosePopup() {
		this.tabs.forEach(function(tab, tabid) { this.comm.toContent(tabid, "close", {}); }.bind(this));
	}

	/**
	* @method fromContentMiddleWare: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromContentMiddleWare(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message, "tab", tabid);

		switch(type) {

			case "trace":
				trace.apply(null, message["params"]);
				return false;
				break;

		}

		return this.fromContent(tabid, type, message, callback)
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}

	/**
	* @method fromWeb: message from web page
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
	}

	/**
	* @method fromPopup: message from popup
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromPopup(type, message, callback) {
		//if(DEBUG) trace(type, "from popup :", message);
	}

	/**
	* @method popupState: send tab list to popup
	* @param tab: async active tab
	*/
	static popupState(tab) {
		this.comm.toPopup("tabs", {"tabs": Array.from(this.tabs.keys()), "active": tab}, die);
	}

	/**
	* @public
	* @method activeTab: fetch active chrome tab
	* @param {Function} callback:
	*/
	static activeTab(callback) {
		chrome.tabs.query({"active": true, "currentWindow": true}, function(tabs) {
			callback(tabs[0]);
		});
	}

	static updateTab(tabid, updateInfos, callback) {
		chrome.tabs.update(tabid, updateInfos, callback);
	}


	// TOOLBOX


	static createWindow(url, x, y, width, height, callback) {
		chrome.windows.create({
			"url": url,
			"left": x,
			"top": y,
			"width": width,
			"height": height,
			//"focused": true,
			"incognito": false,
			"type": "popup", // "normal", "popup"
			"state": "normal", // "normal", "minimized", "maximized", "fullscreen"
			"setSelfAsOpener": false
		}, callback);
	}

	static updateWindow(windowId, updateInfo, callback) {
		chrome.windows.update(windowId, updateInfo, callback);
	}

	static closeWindow(windowId, callback) {
		chrome.windows.remove(windowId, callback);
	}

	static allWindows(callback) {
		chrome.windows.getAll({"populate": true, "windowTypes": ["popup"]}, callback);
	}

	static setBadgeText(text, callback) {
		chrome.browserAction.setBadgeText({"text": text}, callback);
	}

	static setBadgeColor(color, callback) {
		chrome.browserAction.setBadgeBackgroundColor({"color": color}, callback);
	}

	/**
	* @method muteTab: mute tab
	* @param {number} tabid: tab id
	* @param {Function} callback:
	*/
	static muteTab(tabid, callback) {
		this.updateTab(tabid, {"muted": true}, callback);
	}

	/**
	* @method unmuteTab: unmute tab
	* @param {number} tabid: tab id
	* @param {Function} callback:
	*/
	static unmuteTab(tabid, callback) {
		this.updateTab(tabid, {"muted": false}, callback);
	}

	static reloadTab(tabid, callback) {
		chrome.tabs.reload(tabid, {"bypassCache": false}, callback);
	}

	/**
	* @public
	* @method exec: UNSAFE execute code in page
	* @param {number} tabid:
	* @param code:
	* @param {Function} callback:
	*/
	static exec(tabid, code, callback) {
		chrome.tabs.executeScript(tabid, {"code": code}, callback);
	}

	static download(options, callback) {
		chrome.downloads.download(options, callback)
	}
}

/**
* @nocollapse
* @extends {ExtensionScript}
*/
class ExtensionContentScript extends ExtensionScript {

	constructor() {
		super(); // useless, for closure compiler
	}

	static initialize() {
		super.initialize();

		this.tabid = 0;

		if(COMM_TYPE == COMM_PORT) this.comm = new ContentPort(this.commConnected.bind(this), this.fromBackgroundMiddleware.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this), this.onHandle.bind(this));
		if(COMM_TYPE == COMM_MESSAGE) this.comm = new ContentMessage(this.commConnected.bind(this), this.fromBackgroundMiddleware.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this), this.onHandle.bind(this));
	}

	/**
	* @method commConnected: communications ready
	* @param {number} tabid:
	*/
	static commConnected(tabid) {
		this.tabid = tabid;
		this.inject(["base/extbase.js", "web.js"], this.webInjected.bind(this));
		//this.inject(["extension.min.js"], this.webInjected.bind(this));
	}

	static webInjected() {
		this.initialized();
	}

	static initialized() {
		if(DEBUG) trace(this.name, ":", this.tabid, "initialized");
	}

	/**
	@method load: load a js file
	@param {string|Array} src: url or array
	@param {Function} callback: method called once scripts are loaded
	@return void
	*/
	static inject(src, callback) { // + progress ? :P
		if(!(src instanceof Array)) src = [src];
		var list = src.slice();
		var args = Array.prototype.slice.call(arguments);
		doLoad(src[0]);

		function doLoad(script) {
			if(DEBUG) trace("load script : " + script);
			var url = chrome.extension.getURL("resources/" + script);
			var scr = document.createElement("script");
			scr.async = 1;
			document.head.appendChild(/** @type {!Element} */(scr));
			scr.onload = scr.onreadystatechange = /** @param {!Event|null} _ @param {*=} isAbort @return {?}*/function(_, isAbort) {
				if(isAbort || !scr.readyState || /loaded|complete/.test(scr.readyState)) {
					scr.onload = scr.onreadystatechange = null;
					scr = undefined;
					if(!isAbort) if(DEBUG) trace("script loaded :", src[0]);
					else trace("script load fail :", src[0]);
					src.shift();
					if(src.length == 0) callback.apply(this, [list].concat(args.slice(2)));
					else doLoad(src[0]);
				}
				else {
					trace("script load fail :", src[0]);
				}
			};
			scr.src = url;
		}
	}

	/**
	* @method fromBackgroundMiddleware: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromBackgroundMiddleware(type, message, callback) {
		if(DEBUG) trace(type, "from background :", message);

		switch(type) {

			case "update":
				this.onUpdate(message);
				return false;
				break;

			case "open":
				this.onOpenPopup();
				return false;
				break;

			case "close":
				this.onClosePopup();
				return false;
				break;

		}

		return this.fromBackground(type, message, callback);
	}

	/**
	* @method fromBackground: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromBackground(type, message, callback) {
		if(DEBUG) trace(type, "from background :", message);
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromContent(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromWeb(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from web :", message, "tab", tabid);
	}

	/**
	* @method fromPopup: received message from popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromPopup(type, message, callback) {
		if(DEBUG) trace(type, "from popup :", message);
	}

	static onOpenPopup() {
	}

	static onClosePopup() {

	}

	static onUpdate(info) {

	}

	static onHandle(tabid) {
		if(DEBUG) trace("new content", tabid);
	}

}

/**
* @nocollapse
*/
class ExtensionWebScript extends ExtensionScript {

	constructor() {
		super(); // useless, for closure compiler
	}

	static initialize() {
		super.initialize();

		if(COMM_TYPE == COMM_PORT) this.comm = new WebPort(this.extid, this.commConnected.bind(this), this.fromBackground.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this));
		if(COMM_TYPE == COMM_MESSAGE) this.comm = new WebMessage(this.extid, this.commConnected.bind(this), this.fromBackground.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this));
	}

	/**
	* @method commConnected: communications ready
	* @param {number} tabid:
	*/
	static commConnected(tabid) {
		this.tabid = tabid;
		this.initialized();
	}

	static initialized() {
		if(DEBUG) trace(this.name, "initialized");
	}

	/**
	* @method fromBackground: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromBackground(type, message, callback) {
		if(DEBUG) trace(type, "from background :", message);
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromContent(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromWeb(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}

	/**
	* @method fromPopup: received message from popup script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromPopup(type, message, callback) {
		if(DEBUG) trace(type, "from popup :", message);
	}

}

/**
* @nocollapse
* @extends {ExtensionScript}
*/
class ExtensionPopupScript extends ExtensionScript {

	constructor() {
		super(); // useless, for closure compiler
	}

	static initialize() {
		super.initialize();

		if(COMM_TYPE == COMM_PORT) this.comm = new PopupPort(this.commConnected.bind(this), this.fromBackgroundMiddleware.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this));
		if(COMM_TYPE == COMM_MESSAGE) this.comm = new PopupMessage(this.commConnected.bind(this), this.fromBackgroundMiddleware.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this));
	}

	/**
	* @method commConnected: communications ready
	*/
	static commConnected() { // TODO all tabs infos
		this.initialized();
	}

	static initialized() {
		if(DEBUG) trace(this.name, "initialized");
	}

	static onTabs(tabs, activeTab) {
		//if(DEBUG) trace(activeTab, tabs);
		this.tabs = tabs;
		this.activeTab = activeTab;
	}

	/**
	* @method fromBackgroundMiddleware: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromBackgroundMiddleware(type, message, callback) {
		if(DEBUG) trace(type, "from background :", message);

		switch(type) {

			case "tabs":
				this.onTabs(message["tabs"], message["active"]);
				return false;
				break;

		}

		return this.fromBackground(type, message, callback);
	}

	/**
	* @method fromBackground: received message from background script
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromBackground(type, message, callback) {
		if(DEBUG) trace(type, "from background :", message);
	}

	/**
	* @method fromContent: received message from content script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromContent(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}

	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid:
	* @param {string} type:
	* @param {Object} message:
	* @param {Function} callback:
	*/
	static fromWeb(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from web :", message, "tab", tabid);
	}

	// TODO : fromPopup ? // other popup ?
}

/**
* @method merge: merge objects
* @param {...*} var_args
*/
function merge(var_args) {
	return Object.assign.apply(null, Array.prototype.slice.call(arguments));
}

/**
* @method trace: console.log with file name and line number
* @param {...*} var_args
*/
function trace(var_args) {
	// return; // no trace
	var args = Array.prototype.slice.call(arguments);
	if(DEBUG) {
		var stack = new Error().stack.trim(), re = /([\w\.]+)\.js:(\d+)/gmi, fileLine = null, n = 0;
		while(fileLine = re.exec(stack)) if(++n == 2) break;
		args.push("// " + fileLine[1] + ":" + fileLine[2]);
	}
	console.log.apply(console, args);
}

/**
* https://youtu.be/OnoNITE-CLc?t=1m22s
**/
function liftoff(classRef) {
	whereami() == "background" && classRef.prototype instanceof ExtensionBackgroundScript ? classRef.initialize() : (whereami() == "content" && classRef.prototype instanceof ExtensionContentScript ? classRef.initialize() : (whereami() == "popup" && classRef.prototype instanceof ExtensionPopupScript ? classRef.initialize() : (whereami() == "web" && classRef.prototype instanceof ExtensionWebScript ? classRef.initialize() : die())));
}

function whereami() {
	/*if(chrome && chrome.extension && chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() === window) {
		return "BACKGROUND";
	}
	else if(chrome && chrome.extension && chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() !== window) {
		return "POPUP";
	}
	else if(!chrome || !chrome.runtime || !chrome.runtime.onMessage) {
		return "WEB";
	}
	else {
		return "CONTENT";
	}*/
	return (chrome && chrome.extension && chrome.extension.getBackgroundPage ? (chrome.extension.getBackgroundPage() === window ? "background" : "popup") : (!chrome || !chrome.runtime || !chrome.runtime.onMessage ? "web" : "content")); // lol 1-liner
}

/**
* @method trace: console.log with file name and line number
* @param {string=} causeOfDeath
*/
function die(causeOfDeath) {
	if(typeof causeOfDeath !== undefined && causeOfDeath != undefined) trace("DIE", causeOfDeath);
}
