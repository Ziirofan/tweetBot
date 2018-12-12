/**
 * @nocollapse
 * @extends {AutoContentScript}
 * @final
 */
class CustomExtensionContent extends AutoContentScript {

    constructor() {
        super(); // useless, for closure compiler
    }

    /*
     * Méthode appelé à la création de l'objet (initialisation de la page)
     * Ajouter ici les fonctionnalité pour prendre en compte les actions du
     * bot qu'il effectuera au début.
     * la Observer permet de surveiller des changement d'élement dans la page.
     */
    static initialized() {
        trace(this.name, "custom init");
        Observer.watch(document.body, {
            childList: true,
            subtree: true
        }, this.trackNavigation.bind(this));


        this.actionTweet("tweeter", "Bonjour");
    }
    static actionTweet(action, message) {

        console.log("action: " + action);
        trace("click & type");
        switch (action) {
            case "tweeter":
                return this.tweeter(message);
                break;
            case "commenter":
                return this.commenter(message);
                break;
            case "retweeter":
                return this.retweeter();
                break;
            default:
                console.log("action non implémenté");
        }



    }





    static trackNavigation(trackid, item, element, mutationtype, mutation) {
        //trace(mutation);
    }

    static onUpdate(info) {
        return trace(info);
        if (info.hasOwnProperty("url")) {
            trace("url change");
        }
        if (info.hasOwnProperty("status") && info["status"] == "complete") {
            trace("page loaded");
        }
    }

    static fromBackground(type, message, callback) { // message from background script
        if (super.fromBackground(type, message, callback)) return true;


        //callback(); // ack to background, here or in async handler
        //return true; // to enable async callback
    }

    static fromWeb(tabid, type, message, callback) { // message from web script
        if (super.fromWeb(tabid, type, message, callback)) return true;

        //callback(); // ack to background, here or in async handler
        //return true; // to enable async callback
    }

    static fromPopup(type, message, callback) { // message from popup script
        if (super.fromPopup(type, message, callback)) return true;


        //callback(); // ack to background, here or in async handler
        return true; // to enable async callback
    }

    static onOpenPopup() { // called when popup is opened
        super.onOpenPopup(); // do not remove
        //fromBackground(string, message, function(){console.log(message);});
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
