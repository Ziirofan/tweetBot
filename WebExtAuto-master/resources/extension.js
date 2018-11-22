/**
 * @extends {AutoContentScript}
 *
 */
class botExtensionContent extends AutoContentScript {

    constructor() {
        super();
    }

    static initialized() {
        /*
         * Méthode appelé à la création de l'objet (initialisation de la page)
         * Ajouter ici les fonctionnalité pour prendre en compte les actions du
         * bot qu'il effectuera au début.
         * la Observer permet de surveiller des changement d'élement dans la page.
         */
        trace(this.name, "custom init");
        Observer.watch(document.body, {
            childList: true,
            subtree: true
        }, this.trackNavigation.bind(this));

        /*
         * Lazy permet d'effectuer une action dans un temps passé en paramètre pour
         * delay, ou une option avec hooman.
         */
        Lazy.hooman(function() {

            trace("click & type"); // ???le traçage n'est ici pas encore déterminé

            /*
             * Utilisation de variable pour le modèle du xpath à rechercher
             */
            var pathsTweet = '//div[@id="tweet-box-home-timeline"]'; /*Élement box pour tweeter un message*/
            var pathsBouton = '//*[@id="timeline"]/div[2]/div/form/div[3]/div[2]/button'; /*Element du bouton d'envoi*/


            /*
             * Variables dans lequel les chemins trouvé seront affecté,
             * Test Pour déterminer si l'élément à bien été trouvé.
             */
            var champsDeTweet;
            var boutonPoster;

            champsDeTweet = new xph().ctx(document).craft(pathsTweet).firstResult();
            boutonPoster = new xph().ctx(document).craft(pathsTweet).firstResult();
            if (champsDeTweet === null || boutonPoster === null) return trace("element not found");

        }.bind(this), "short");
    }

}


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

        /*
         * Lazy permet d'effectuer une action dans un temps passé en paramètre pour
         * delay, ou une option avec hooman.
         */
        Lazy.hooman(function() {

            trace("click & type"); // ???le traçage n'est ici pas encore déterminé

            /*
             * Utilisation de variable pour le modèle du xpath à rechercher
             */
            var pathsTweet = '//div[@id="tweet-box-home-timeline"]'; /*Élement box pour tweeter un message*/
            var pathsBouton = '//*[@id="timeline"]/div[2]/div/form/div[3]/div[2]/button'; /*Element du bouton d'envoi*/


            /*
             * Variables dans lequel les chemins trouvé seront affecté,
             * Test Pour déterminer si l'élément à bien été trouvé.
             */
            var champsDeTweet;
            var boutonPoster;

            champsDeTweet = new xph().ctx(document).craft(pathsTweet).firstResult();
            boutonPoster = new xph().ctx(document).craft(pathsBouton).firstResult();
            if (champsDeTweet === null || boutonPoster === null) return trace("element not found");

            /*
             * Utilisation de la méthode click pour simuler le click sur un élement de la page.
             * Utilisation de la méthode type pour simuler une tape au clavier
             */

            this.click(champsDeTweet, function(result) {
                this.type("Hello World", function(result) {
                    this.click(boutonPoster, function(result) {}.bind(this));
                }.bind(this));
            }.bind(this));




        }.bind(this), "short");
        //
        //         Lazy.delay(function() {
        //
        //         	//var hlp = new xph().ctx(document).path("//div").group().textContains("hellftfso").or().textEquals("hello world !").close().firstResult();
        //         	//trace(hlp);
        //
        //         	trace("click & type");
        // // //*[@id="tweet-box-home-timeline"]
        // ////*[@id="swift_tweetbox_1542645621850"]/div[3]/div[2]/button
        //         	var paths = [
        //         		'//div[@id="tweet-box-home-timeline"]', 			// twitter
        //                 '//[@id="swift_tweetbox_1542645621850"]/div[3]/div[2]/button',
        //         		'//input[@id="uh-search-box"]', 		// yahoo
        //         		'//input[@aria-label="Search"]', 		// google
        //         		'//input[@id="searchInput"]', 			// wikipedia
        //         		'//input[@aria-label="search_bar"]', 	// qwant
        //         		'//input[@placeholder="Search"]', 		// instagram
        //         	];
        //             var path2 = ['//*[@id="swift_tweetbox_1542645621850"]/div[3]/div[2]/button'];
        //         	var searchfield = null;
        //             var searchbutton = null;
        //
        //         	for(var i = 0, l = paths.length; i < l; i++) {
        //         		searchfield = new xph().ctx(document).craft(paths[i]).firstResult();
        //         		if(searchfield !== null) break;
        //         	}
        //         	if(searchfield === null) return trace("search field not found");
        //
        //             for(var i = 0, l = path2.length; i < l; i++) {
        //         		searchbutton = new xph().ctx(document).craft(path2[i]).firstResult();
        //         		if(searchbutton !== null) break;
        //         	}
        //         	if(searchbutton === null) return trace("button tweet not found");
        //
        //
        //
        //
        //         	this.click(searchfield, function(result) {
        //         		this.type("helloworld", function() {
        //         			this.click(searchbutton, function() {
        //         				trace("perform search");
        //         			}.bind(this));
        //         		}.bind(this));
        //         	}.bind(this));
        //
        //         }.bind(this), 1000);

        // Lazy.delay(function() {
        //
        //     trace("click & tape");
        //
        //     var path = [
        //         'div[@id="user-dropdown"]'
        //     ];
        //     var tweetButton = null;
        //     for (var i = 0, l = path.length; i < l; i++) {
        //         tweetButton = new xph().ctx(document).craft(path[i]).firstResult();
        //         if (tweetButton !== null) break;
        //     }
        //     if (tweetButton === null) return trace("tweetButton not found");
        //     this.click(tweetButton, function(result) {}.bind(this));
        // });


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
