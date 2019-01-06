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

        this.follow();


    }

    static follow() {

        ////*[@id="page-container"]/div[1]/div[2]/div[1]/div[1]/small[2]/a
        ////*[@id="stream-item-user-*"]/div/div[1]/div/span/button[1]
        /*
            




        
        let f = document.getElementsByClassName('follow-button')
        console.log(f);
        for(let i= 0; i<f.length;i++){
            f[i].click();
        }*/
        async function glick() {
            let pathA = '//*[@id="page-container"]/div[1]/div[2]/div[1]/div[1]/small[2]/a'
            let click = this.clickOnElement(pathA, "6000");
            console.log(click);
            let pathcrafted = new xph().ctx(document).craft(pathA).textContains("suivre");
        }
        async function fol() {
            await glick.call(this);
            Lazy.delay(function() {
                this.click(pathcrafted);

            }.bind(this), "1000");
            c = document.evaluate('//text()[contains(name(.), suivre)]', document.body, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
            var thisNode = c.iterateNext();

            while (thisNode) {
                console.log(thisNode.textContent);
                thisNode = c.iterateNext();
            }
        }
        fol.call(this);
        //console.log(r);



        /*
         * Utiliser une promise, quand celle-ci est tenue on cherche ensuite l'element
         * follow par une recherche par nom. 
         */
        /*function attenteClick() {
            return new Promise((resolve, reject) => {

                let path = '//*[@id="page-container"]/div[1]/div[2]/div/ul/li[3]/a'
                let retour = this.clickOnElement(path, "5000")
                if (retour)
                    resolve("true");
                else
                    resolve("false");
            });
        }
        async function follower() {
            let reponse = await attenteClick.call(this);
            if (reponse === "true") {
                let path2 = '//*[@id="page-container"]/div[2]/div/div/div[2]/div/div/div/div[2]/div[1]/div[1]/div/div/div[1]/div/div/div/span[2]/button[1]'
                this.clickOnElement(path2, "6000");
            } else
                console.log("erreur de resolution de promesse");
        }

        /*   console.log("recherche de bouton follow");
           let c = document.evaluate('//text()[contains(name(.), suivre)]',document.body,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);
           console.log(c);*/
        /*this.actionTweet("rechercher", "Bonjour");
        follower.call(this);*/



    }



    static actionTweet(action, message) {

        console.log("action: " + action);
        trace("click & type");
        switch (action) {
            case "rechercher":
                return this.rechercher(message);
                break;
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
        //return true; // to enable async callback
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