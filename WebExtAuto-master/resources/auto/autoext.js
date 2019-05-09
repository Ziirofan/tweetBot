/**
 * @nocollapse
 * @extends {ExtensionBackgroundScript}
 */
class AutoBackgroundScript extends ExtensionBackgroundScript {

    constructor() { // useless, for closure compiler
        super();
    } 

    /**
     * @method initialize:
     */
    static initialize() {
        super.initialize();

        this.parseKeyboard();
    }

    /**
     * @method parseKeyboard: map keys
     */
    static parseKeyboard() {
        // from https://github.com/timoxley/keycode

        this.keys = {
            "backspace": 8,
            "tab": 9,
            "\r": 13, // enter
            "shift": 16,
            "ctrl": 17,
            "alt": 18,
            "pause/break": 19,
            "caps lock": 20,
            "esc": 27,
            "space": 32,
            "page up": 33,
            "page down": 34,
            "end": 35,
            "#": 51, // wtf
            "home": 36,
            "left": 37,
            "up": 38,
            "right": 39,
            "down": 40,
            "insert": 45,
            "delete": 46,
            "command": 91,
            "left command": 91,
            "right command": 93,
            "numpad *": 106,
            "numpad +": 107,
            "numpad -": 109,
            "numpad .": 110,
            "numpad /": 111,
            "num lock": 144,
            "scroll lock": 145,
            "my computer": 182,
            "my calculator": 183,
            ";": 186,
            "=": 187,
            ",": 188,
            "-": 189,
            ".": 190,
            "/": 191,
            "'": 192,
            "[": 219,
            "\\": 220,
            "]": 221,
            "\"": 222
        }
        let i;
        for (i = 97; i < 123; i++) this.keys[String.fromCharCode(i)] = i - 32; // lower case chars
        for (i = 48; i < 58; i++) this.keys[i - 48] = i; // numbers
    }

    /**
     * @method fromContent: received message from content script
     * @param {number} tabid:
     * @param {string} type:
     * @param {Object} message:
     * @param {Function} callback:
     */
    static fromContent(tabid, type, message, callback) {
        super.fromContent(tabid, type, message, callback); // don't remove this one, super has work to do

        switch (type) {
            case "click":
                this.click(tabid, message, callback);
                return true;
                break;

            case "press":
                this.key(tabid, message, callback);
                return true;
                break;

            case "type":
                this.type(tabid, message, callback);
                return true;
                break;

            case "scroll":
                this.scroll(tabid, message, callback);
                return true;
                break;
        }

    }
    
	static fromPopup(tabid, type, message, callback) {
        super.fromPopup(tabid, type, message, callback); // don't remove this one, super has work to do

        switch (type) {
            case "click":
                this.click(tabid, message, callback);
				console.log("BBBB");
                return true;
                break;

            case "press":
                this.key(tabid, message, callback);
                return true;
                break;

            case "type":
                this.type(tabid, message, callback);
                return true;
                break;

            case "scroll":
                this.scroll(tabid, message, callback);
                return true;
                break;
        }
	}



    // keyboard events // TODO shorten type method by calling key on every loop + merge keydown / char / up methods

    /**
     * @method key: press key (mostly return key :)
     * @param {number} tabid:
     * @param {string} key:
     * @param {Function} callback:
     */
    static key(tabid, key, callback) {
        //key = key.substring(0, 1).toUpperCase() + key.substring(1); // CAPS first letter
        trace("press key", key);
        let keycode = this.keys[key];
        chrome.debugger.attach({
            "tabId": tabid
        }, "1.2", attached.bind(this));

        function attached() {
            Lazy.delay(keyDown.bind(this), MoreMath.randRange(115, 230));
        }

        function keyDown() {
            this.keyboardDown(tabid, keycode, key, keyDowned.bind(this));
        }

        function keyDowned(result) {
            keyChar.bind(this)();
        }

        function keyChar() {
            this.keyboardChar(tabid, keycode, key, keyChared.bind(this));
        }

        function keyChared(result) {
            Lazy.delay(keyUp.bind(this), MoreMath.randRange(50, 75));
        }

        function keyUp() {
            this.keyboardUp(tabid, keycode, key, keyUped.bind(this));
        }

        function keyUped(result) {
            keyed();
        }

        function keyed() {
            chrome.debugger.detach({
                "tabId": tabid
            }, detached.bind(this));
        }

        function detached() {
            callback();
        }
    }

    /**
     * @method type: type text on keyboard
     * @param {number} tabid:
     * @param {string} chars:
     * @param {Function} callback:
     */
    static type(tabid, chars, callback) { // TODO : check runtime.lastError after every debugger command
        trace("type", chars);
        let charrs = chars.split("");
        let key = charrs.shift();
        let keycode = this.keys[key];
        chrome.debugger.attach({
            "tabId": tabid
        }, "1.2", attached.bind(this));

        function attached() {
            Lazy.delay(keyDown.bind(this), MoreMath.randRange(115, 230));
        }

        function keyDown() {
            this.keyboardDown(tabid, keycode, key, keyDowned.bind(this));
        }

        function keyDowned(result) {
            keyChar.bind(this)();
        }

        function keyChar() {
            this.keyboardChar(tabid, keycode, key, keyChared.bind(this));
        }

        function keyChared(result) {
            Lazy.delay(keyUp.bind(this), MoreMath.randRange(50, 75));
        }

        function keyUp() {
            this.keyboardUp(tabid, keycode, key, keyUped.bind(this));
        }

        function keyUped(result) {
            if (charrs.length == 0) typed();
            else {
                key = charrs.shift();
                keycode = this.keys[key];
                Lazy.delay(keyDown.bind(this), 25 + MoreMath.randRange(50, 150));
            }
        }

        function typed() {
            chrome.debugger.detach({
                "tabId": tabid
            }, detached.bind(this));
        }

        function detached() {
            callback();
        }
    }

    /**
     * @method keyboardDown:
     * @param {number} tabid:
     * @param {number} keycode:
     * @param {string} keystr:
     * @param {Function} callback:
     */
    static keyboardDown(tabid, keycode, keystr, callback) {
        chrome.debugger.sendCommand({
                "tabId": tabid
            }, "Input.dispatchKeyEvent", {
                "type": "rawKeyDown",
                "windowsVirtualKeyCode": keycode,
                "nativeVirtualKeyCode": keycode,
                "macCharCode": keycode,
                "unmodifiedText": keystr,
                "text": keystr,
                "timestamp": Date.now()
            },
            callback);
    }

    /**
     * @method keyboardChar:
     * @param {number} tabid:
     * @param {number} keycode:
     * @param {string} keystr:
     * @param {Function} callback:
     */
    static keyboardChar(tabid, keycode, keystr, callback) {
        chrome.debugger.sendCommand({
                "tabId": tabid
            }, "Input.dispatchKeyEvent", {
                "type": "char",
                "windowsVirtualKeyCode": keycode,
                "nativeVirtualKeyCode": keycode,
                "macCharCode": keycode,
                "unmodifiedText": keystr,
                "text": keystr,
                "timestamp": Date.now()
            },
            callback);
    }

    /**
     * @method keyboardUp:
     * @param {number} tabid:
     * @param {number} keycode:
     * @param {string} keystr:
     * @param {Function} callback:
     */
    static keyboardUp(tabid, keycode, keystr, callback) {
        chrome.debugger.sendCommand({
                "tabId": tabid
            }, "Input.dispatchKeyEvent", {
                "type": "keyUp",
                "windowsVirtualKeyCode": keycode,
                "nativeVirtualKeyCode": keycode,
                "macCharCode": keycode,
                "unmodifiedText": keystr,
                "text": keystr,
                "timestamp": Date.now()
            },
            callback);
    }

    /// keyboard events

    // mouse events

    /**
     * @method click: click somewhere
     * @param {number} tabid:
     * @param {Object} data:
     * @param {Function} callback:
     */
    static click(tabid, data, callback) {
        trace("click", data["x"], ",", data["y"]);
        chrome.debugger.attach({
            "tabId": tabid
        }, "1.2", attached.bind(this));

        function attached() {
            mouseMove.bind(this)();
        }

        function mouseMove() {
            this.mouseMove(tabid, data["x"], data["y"], mouseMoved.bind(this));
        }

        function mouseMoved(result) {
            Lazy.delay(mouseDown.bind(this), MoreMath.randRange(35, 75));
        }

        function mouseDown() {
            this.mouseDown(tabid, data["x"], data["y"], mouseDowned.bind(this));
        }

        function mouseDowned(result) {
            Lazy.delay(mouseUp.bind(this), MoreMath.randRange(35, 75));
        }

        function mouseUp() {
            this.mouseUp(tabid, data["x"], data["y"], mouseUped.bind(this));
        }

        function mouseUped(result) {
            chrome.debugger.detach({
                "tabId": tabid
            }, detached.bind(this));
        }

        function detached() {
            callback();
        }
    }

    /**
     * @method mouseDown:
     * @param {number} tabid:
     * @param {Object} x:
     * @param {Object} y:
     * @param {Function} callback:
     */
    static mouseDown(tabid, x, y, callback) {
        chrome.debugger.sendCommand({
            "tabId": tabid
        }, "Input.dispatchMouseEvent", {
            "type": "mousePressed",
            "button": "left",
            "x": x,
            "y": y,
            "clickCount": 1,
            "timestamp": Date.now()
        }, callback);
    }

    /**
     * @method mouseUp:
     * @param {number} tabid:
     * @param {Object} x:
     * @param {Object} y:
     * @param {Function} callback:
     */
    static mouseUp(tabid, x, y, callback) {
        chrome.debugger.sendCommand({
            "tabId": tabid
        }, "Input.dispatchMouseEvent", {
            "type": "mouseReleased",
            "button": "left",
            "x": x,
            "y": y,
            "clickCount": 1,
            "timestamp": Date.now()
        }, callback);
    }

    /**
     * @method scroll:
     * @param {number} tabid:
     * @param {Object} data:
     * @param {Function} callback:
     */
    static scroll(tabid, data, callback) {
        trace("scroll", data["x"], data["y"], data["deltaY"]);
        let scrollSize = 100 * (data["deltaY"] / Math.abs(data["deltaY"]));
        let scrolls = Math.ceil(data["deltaY"] / scrollSize);
        chrome.debugger.attach({
            "tabId": tabid
        }, "1.2", attached.bind(this));

        function attached() {
            mouseMove.bind(this)();
        }

        function mouseMove() {
            this.mouseMove(tabid, data["x"], data["y"], mouseMoved.bind(this));
        }

        function mouseMoved(result) {
            Lazy.delay(wheel.bind(this), MoreMath.randRange(35, 75));
        }

        function wheel() {
            scrolls--;
            chrome.debugger.sendCommand({
                "tabId": tabid
            }, "Input.dispatchMouseEvent", {
                "type": "mouseWheel",
                "button": "middle",
                "deltaY": scrollSize,
                "deltaX": 0,
                "x": data["x"],
                "y": data["y"],
                "clickCount": 0,
                "timestamp": Date.now(),
            }, wheeled.bind(this));
        }

        function wheeled() {
            if (scrolls > 0) Lazy.delay(wheel.bind(this), MoreMath.randRange(80, 140));
            else scrolled.bind(this)();
        }

        function scrolled() {
            chrome.debugger.detach({
                "tabId": tabid
            }, detached.bind(this));
        }

        function detached() {
            callback();
        }
    }

    /**
     * @method mouseMove:
     * @param {number} tabid:
     * @param {Object} x:
     * @param {Object} y:
     * @param {Function} callback:
     */
    static mouseMove(tabid, x, y, callback) {
        chrome.debugger.sendCommand({
            "tabId": tabid
        }, "Input.dispatchMouseEvent", {
            "type": "mouseMoved",
            "x": x,
            "y": y,
            "timestamp": Date.now()
        }, callback);
    }

    /// mouse events

}

/**
 * @nocollapse
 * @extends {ExtensionContentScript}
 */
class AutoContentScript extends ExtensionContentScript {

    constructor() { // useless, for closure compiler
        super();
    }

    static initialize() {
        super.initialize();
        Observer.initialize();
    }

    // mouse

    /**
     * @method click: click element
     * @param {Node} element:
     * @param {Function} callback:
     */
    static click(element, callback) {
        /*
        // working, savage
        let trigger = document.createEvent("MouseEvent");
        trigger.initMouseEvent("click", true, true, null, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        el.dispatchEvent(trigger);
        */

        trace("click", element.nodeName);

        callback = callback || die;

        // left, top, right, bottom, x, y, width, height
        let elrect = element.getBoundingClientRect();
        let bodyrect = document.body.getBoundingClientRect();

        let bw = bodyrect.width;
        let bh = bodyrect.height;

        let bs = 500;//document.documentElement.scrollTop || document.body.scrollTop;

        let offset = 5;
        let elx = elrect.left;
        let ely = elrect.top;
        let elw = elrect.width;
        let elh = elrect.height;

        let cx = Math.round(MoreMath.randRange(elx + offset, elx + elw - offset));
        let cy = Math.round(MoreMath.randRange(ely + offset, ely + elh - offset));

        trace("click", element, "[" + elx + "," + ely + " " + elw + "x" + elh);
        trace("body", bw + "x" + bh, "scroll", bs);

        if (cy > bs - elh ) {
            if (DEBUG) trace("not in viewport, scroll");
            if (DEBUG) console.log("ely: "+cy+ " bs: "+bs+" elh: "+elh+ "= "+(bs-elh));
            this.comm.toBackground("scroll", {
                "x": cx,
                "y": cy,
                "deltaY": ely - bs - elh
            }, function(result, el, ca) {
                Lazy.delay(this.click.bind(this), 2000, el, ca);
            }.bind(this), element, callback); 
        } else {
            this.comm.toBackground("click", {
                "x": cx,
                "y": cy
            }, callback);
        }
    }

    /**
     * @method scroll: scroll element
     * @param {Node} element:
     * @param {number} deltaY: scroll pixels (positive or negative)
     * @param {Function} callback:
     */
    static scroll(element, deltaY, callback) {
        trace("scroll", element.nodeName, deltaY);

        callback = callback || die;

        // left, top, right, bottom, x, y, width, height
        let elrect = element.getBoundingClientRect();
        let bodyrect = document.body.getBoundingClientRect();

        let bw = bodyrect.width;
        let bh = bodyrect.height;

        let bs = document.documentElement.scrollTop || document.body.scrollTop;

        let offset = 5;
        let elx = elrect.left;
        let ely = elrect.top;
        let elw = elrect.width;
        let elh = elrect.height;

        let cx = Math.round(MoreMath.randRange(elx + offset, elx + elw - offset));
        let cy = Math.round(MoreMath.randRange(ely + offset, ely + elh - offset));

        this.comm.toBackground("scroll", {
            "x": cx,
            "y": cy,
            "deltaY": deltaY
        }, callback);
    }

    /// mouse


    // keyboard

    /**
     * @method type: type text on keyboard
     * @param {string} text:
     * @param {Function} callback:
     */
    static type(text, callback) {
        trace("type", "\"" + text + "\"");
        this.comm.toBackground("type", text, callback);
    }

    /**
     * @method press: press single key
     * @param {string} key:
     * @param {Function} callback:
     */
    static press(key, callback) {
        this.comm.toBackground("press", key, die);
    }

    /// keyboard

     /**
     * @method clickOnElement: click on one element selected by path
     * @param {string} path:
     * @param {Function} delay:
     */
	
	static clickOnElement(path,delay){
		Lazy.delay(function(){
		let pathEleme = new xph().ctx(document).craft(path).firstResult();
		if(pathEleme == null)
			return false;
		else{
			this.click(pathEleme, function(result){ return true;});
            return true;
        }
	}.bind(this),delay);
	}

	/**
	 * @method rechercher : recherche un mot
	 * @param {string} keyword :
	 *
	 */
    static rechercher(message) {
        Lazy.delay(function(message) {
            var pathsSearch = '//input[@id="search-query"]';

            var champsDeRecherche = new xph().ctx(document).craft(pathsSearch).firstResult();

            if (champsDeRecherche === null)
                return false /*trace("element not found")*/;

            this.click(champsDeRecherche, function(result) {
                this.type("h", function(result) {
                    this.press("\r", function(result) {}.bind(this));
                }.bind(this));
            }.bind(this));
        }.bind(this), "1000");
	}

	/**
     * @method tweeter: tweeter string text
     * @param {string} message:
     */

    static tweeter(message) {
        Lazy.delay(function(message) {

            var pathsTweet = '//div[@id="tweet-box-home-timeline"]'; /*Élement box pour tweeter un message*/
            var pathsBouton = '//*[@id="timeline"]/div[2]/div/form/div[3]/div[2]/button'; /*Element du bouton d'envoi*/
            let nbr = Math.floor(Math.random() * Math.floor(10));
            let mes = this.tendanceAr[nbr];
            var champsDeTweet = new xph().ctx(document).craft(pathsTweet).firstResult();
            var boutonPoster;
            if (champsDeTweet === null)
                return false;

            this.click(champsDeTweet, function(result) {
                this.type(mes, function(result) {
                    boutonPoster = new xph().ctx(document).craft(pathsBouton).firstResult();
                    this.click(boutonPoster, function(result) {}.bind(this));
                }.bind(this));
            }.bind(this));
            return true;
        }.bind(this), "2000");

    }

	/**
     * @method commenter: comment string text
     * @param {string} message:
     */
    static commenter(message) {
        Lazy.delay(function(message) {
            var pathComment = '//*[@id="stream-items-id"]/li/div/div[2]/div[3]/div[2]/div[1]/button/div/span[1]';
            var pathPostComment = '//*[@id="global-tweet-dialog-dialog"]/div[2]/div[4]/form/div[3]/div[2]/button';
            //*[@id="global-tweet-dialog-dialog"]/div[2]/div[4]/form/div[3]/div[2]/button
            let mes = "retweeter";
            var comment = new xph().ctx(document).craft(pathComment).firstResult();
            var boutonPoste;


            if (comment == null){
                trace("element not found");
                return false /*trace("element not found")*/;
            }

            this.click(comment, function(result) {
                this.type(mes, function(result) {
                    let postComment = new xph().ctx(document).craft(pathPostComment).firstResult();
                    this.click(postComment, function(result) {}.bind(this));
                }.bind(this));
            }.bind(this));
        }.bind(this), "10000");
    }

	/**
     * @method retweeter: retweet
     * @param {string} message:
     */
    static retweeter() {
            let i = this.fol;
            this.fol++;
            var pathRetweet = '//*[@id="stream-items-id"]/li['+i+']/div[1]/div[2]/div[5]/div[2]/div[2]/button[1]/div/span';

            var retweet = new xph().ctx(document).craft(pathRetweet).firstResult();

            if (retweet == null){
                pathRetweet = '//*[@id="stream-items-id"]/li['+i+']/div[1]/div[2]/div[4]/div[2]/div[2]/button[1]/div/span';
                retweet = new xph().ctx(document).craft(pathRetweet).firstResult();
                if(retweet == null){
                    pathRetweet = '//*[@id="stream-items-id"]/li['+i+']/div[1]/div[2]/div[3]/div[2]/div[2]/button[1]/div/span';
                    retweet = new xph().ctx(document).craft(pathRetweet).firstResult();
                    if(retweet == null){
                    console.log("erreur path " + pathRetweet);
                    return false /*trace("element not found")*/;
                    }
                }

                
            }
            //retweet.scrollIntoView();
            this.click(retweet, function(result) {
                console.log("click on "+pathRetweet);
                //this.valideRetweet();
                //this.valideRetweet();
            }.bind(this));
            
            
            /*Lazy.delay(function(){
                this.click(retweet, function(result) {
                //this.valideRetweet();
            }.bind(this));*/


            //}.bind(this),2000);
            
    }

    static valideRetweet(){
            var pathRetV='//*[@id="retweet-tweet-dialog-dialog"]/div[2]/form/div[2]/div[3]/button/span[1]';

            var retV = new xph().ctx(document).craft(pathRetV).firstResult();

            if(retV == null)
                return false;

            this.click(retV, function(result){}.bind(this));   

    }

    /**
     * @method follow: follow account 
     */
    static follow(bouton) {
        Lazy.delay(function(bouton) {
            let pathFollow1 = '//*[@id="page-container"]/div[3]/div[1]/div[1]/div[2]/div['+this.fol+']/div[3]/div/span/button[1]';
            let pathFollow2 = '//*[@id="page-container"]/div[1]/div[2]/div[1]/div[2]/div[2]/div[3]/div/span/button[1]';
            let pathFollow3 = '//*[@id="page-container"]/div[1]/div[2]/div[1]/div[2]/div[3]/div[3]/div/span/button[1]';
            this.fol++;
            //if(this.fol < 5)
                //this.fol = 1;

            let follow1 = new xph().ctx(document).craft(pathFollow1).firstResult();
            let follow2 = new xph().ctx(document).craft(pathFollow2).firstResult();
            let follow3 = new xph().ctx(document).craft(pathFollow3).firstResult();

            if (follow1 == null)
                return false /*trace("element not found")*/;

            this.click(follow1, function(result) {}.bind(this));
            //setTimeout(this.click(follow2, function(result) {}.bind(this)), 2000);
            //this.click(follow3, function(result) {}.bind(this));
        }.bind(this), "1000");
    }
    static controlTweetSponso(){
        let i = this.fol;
            var pathSponso = '//*[@id="stream-items-id"]/li['+i+']/div[1]/div[2]/div[6]/span/span/a';

            var sponso = new xph().ctx(document).craft(pathRetweet).firstResult();
            if(sponso.innerText == "Sponsorisé" || sponso.textContent == "Sponsorisé"){
                return false;
            }

            pathSponso = '//*[@id="stream-items-id"]/li['+i+']/div[1]/div[2]/div[5]/span/span/a';
            sponso = new xph().ctx(document).craft(pathRetweet).firstResult();
            if(sponso.innerText == "Sponsorisé" || sponso.textContent == "Sponsorisé"){
                return false;
            }
                
            pathSponso = '//*[@id="stream-items-id"]/li['+i+']/div[1]/div[2]/div[4]/span/span/a';
            sponso = new xph().ctx(document).craft(pathRetweet).firstResult(); 
            if(sponso.innerText == "Sponsorisé" || sponso.textContent == "Sponsorisé"){
                return false;
            }            
    }
}

/**
 * @nocollapse
 */
class XPathHelper { // XPathHelper

    constructor() {
        this.context = null;
        this.expath = null;
        this.rules = [];
        this.crafted = null;
        this.cgroup = null;
    }

    ctx(ctx) {
        this.context = ctx;
        return this;
    }

    craft(value) {
        this.crafted = value;
        return this;
    }

    path(path) {
        this.expath = path;
        return this;
    }

    group() {
        if (!this.cgroup) this.cgroup = [];
        return this;
    }

    close() {
        if (this.cgroup) {
            this.rules.push(this.cgroup);
            this.cgroup = null;
        }
        return this;
    }

    or() {
        this.push("or");
        return this;
    }

    and() {
        this.push("and");
        return this;
    }

    not() {
        // TODO
    }

    textEquals(value) {
        this.push('text()="' + value + '"');
        return this;
    }

    textContains(needle) {
        this.push('contains(text(), "' + needle + '")');
        return this;
    }

    attributeEquals(attribute, value) {
        this.push('@' + attribute + '="' + value + '"');
        return this;
    }

    attributeContains(attribute, needle) {
        this.push('contains(@' + attribute + ', "' + needle + '")');
        return this;
    }

    push(rule) {
        this.cgroup ? this.cgroup.push(rule) : this.rules.push(rule);
    }

    firstResult() {
        return this.evaluate(XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
    }

    allResults() {
        return this.evaluate(XPathResult.ORDERED_NODE_ITERATOR_TYPE).singleNodeValue;
    }

    build() {
        let expression = this.expath + "[";
        let parts = [];
        for (let i = 0, l = this.rules.length; i < l; i++) {
            if (this.rules[i] instanceof Array) parts.push("(" + this.rules[i].join(" ") + ")");
            else parts.push(this.rules[i]);
        }
        return expression + parts.join(" ") + "]";
    }

    evaluate(resultType) {
        let expression = this.crafted || this.build();
        let ctxNode = this.context;
        let namespace = null;
        let fromresult = null;
        return document.evaluate(expression, ctxNode, namespace, resultType, fromresult);
    }
}

/**
 * @nocollapse
 * @final
 */
class xph extends XPathHelper {} // SHORT NAME

/**
 * @nocollapse
 */
class MoreMath {

    constructor() {}

    /**
     * @method randRange: random int value min <= value <= max
     * @param {Number} min: minimum value
     * @param {Number} max: maximum value
     * @return {Number}
     */
    static randRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

}

/**
 * @nocollapse
 */
class Observer {

    constructor() {}

    static initialize() {
        this.watches = 0;
        this.watched = new Map();
    }

    /**
     * @method watch: watch element, options see https://developer.mozilla.org/fr/docs/Web/API/MutationObserver#MutationObserverInit
     * @param {Node} element:
     * @param {(undefined|{attributeFilter: (Array<string>|undefined), attributeOldValue: (boolean|undefined), attributes: (boolean|undefined), characterData: (boolean|undefined), characterDataOldValue: (boolean|undefined), childList: (boolean|undefined), subtree: (boolean|undefined)})} options:
     * @param {Function} callback:
     * @return {number|void}
     */
    static watch(element, options, callback) {
        if (element.hasAttribute("data-watch")) return trace("already on watch", element.getAttribute("data-watch"));
        let watchid = ++this.watches;
        element.setAttribute("data-watch", watchid);
        let watcher = new window.MutationObserver(this.mutate.bind(this));
        this.watched.set(watchid, {
            "element": element,
            "callback": callback,
            "watcher": watcher
        });
        watcher.observe(element, options);
        trace("watch", element.nodeName, watchid);
        return watchid;
    }

    /**
     * @method unwatch: stop plz
     * @param {number} watchid:
     * @return {void}
     */
    static unwatch(watchid) {
        if (this.watched.has(watchid)) {
            let watch = this.watched.get(watchid);
            //trace("unwatch", watch.element.nodeName, watchid);
            watch.element.removeAttribute("data-watch");
            watch.watcher.disconnect();
            watch.watcher = null;
            this.watched.delete(watchid);
        }
    }

    /**
     * @method mutate: mutation detected
     * @param {Array<MutationRecord>} mutationRecords
     */
    static mutate(mutationRecords) {
        mutationRecords.forEach(this.handleMutation.bind(this));
    }

    /**
     * @method handleMutation: handle mutation
     * @param {MutationRecord} mutation:
     * @param {number} index:
     * @param {Array<MutationRecord>} mutations:
     */
    static handleMutation(mutation, index, mutations) {
        //console.log("mutation : ", mutation.target.nodeName);
        let sel = mutation.target,
            found = false,
            watchid = -1;
        while (sel && sel.parentNode) {
            if (sel.hasAttribute("data-watch")) {
                watchid = parseInt(sel.getAttribute("data-watch"), 10);
                found = true;
                break;
            }
            sel = sel.parentNode;
        }
        if (found) {
            let result = {};
            switch (mutation.type) {
                case "childList":
                    result["addedNodes"] = mutation["addedNodes"];
                    result["removedNodes"] = mutation["removedNodes"];
                    result["previousSibling"] = mutation["previousSibling"];
                    result["nextSibling"] = mutation["nextSibling"];
                    break;

                case "attributes":
                    result["attributeName"] = mutation["attributeName"];
                    result["attributeNamespace"] = mutation["attributeNamespace"];
                    if (result.hasOwnProperty("oldValue")) result["oldValue"] = mutation["oldValue"];
                    result["newValue"] = mutation["target"].getAttribute(mutation["attributeName"]);
                    break;

                case "characterData":
                    if (result.hasOwnProperty("oldValue")) result["oldValue"] = mutation["oldValue"];
                    // TODO new value
                    break;
            }
            this.watched.get(watchid)["callback"].apply(this, [watchid, mutation["target"], sel, mutation["type"], result]);
        } else {
            //trace("ignore mutation", mutation);
        }
    }

    static waitForAppend(parent, child, callback) {
        this.watch(parent, {
                "childList": true,
                "subtree": true
            },
            function(watchid, item, element, mutationtype, mutation) {
                if (mutation["addedNodes"].length > 0) {
                    if (mutation["addedNodes"][0]["nodeName"] == child["nodeName"]) {
                        this.unwatch(watchid);
                        callback();
                    }
                }
            }.bind(this)
        );
    }

    static waitForRemove(parent, child, callback) {
        this.watch(parent, {
                "childList": true,
                "subtree": true
            },
            function(watchid, item, element, mutationtype, mutation) {
                if (mutation["removedNodes"].length > 0) {
                    if (mutation["removedNodes"][0]["nodeName"] == child["nodeName"]) {
                        this.unwatch(watchid);
                        callback();
                    }
                }
            }.bind(this)
        );
    }

    static waitForAttribute(element, attribute, callback) {
        this.watch(element, {
                "attributes": true,
                "attributeFilter": [attribute]
            },
            function(watchid, item, element, mutationtype, mutation) {
                this.unwatch(watchid);
                callback();
            }.bind(this)
        );
    }

}

class Lazy {

    /**
     * @method delay:
     * @param {Function} method:
     * @param {number} ms:
     * @param {...*} var_args
     */
    static delay(method, ms, var_args) {
        return setTimeout(method.bind.apply(method, [null].concat(Array.prototype.slice.call(arguments, 2))), ms);
    }

    /**
     * @method hooman:
     * @param {Function} method:
     * @param {string} level:
     * @param {...*} var_args
     */
    static hooman(method, level, var_args) {
        let delays = {
            "god": {
                "min": 0,
                "max": 1
            },
            "jedi": {
                "min": 50,
                "max": 150
            },
            "short": {
                "min": 400,
                "max": 800
            },
            "medium": {
                "min": 1000,
                "max": 1600
            },
            "long": {
                "min": 2400,
                "max": 3200
            }
        };
        if (!delays.hasOwnProperty(level)) level = "medium";
        return this.delay.apply(this, [method, MoreMath.randRange.apply(this, [delays[level]["min"], delays[level]["max"]])].concat(Array.prototype.slice.call(arguments, 2)));
    }

}
