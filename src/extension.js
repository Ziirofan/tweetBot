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
           this.message = null;
           Observer.watch(document.body, {
               childList: true,
               subtree: true
           }, this.trackNavigation.bind(this));
           this.fol = 1;
           this.tendanceAr = [];


           console.log(localStorage.getItem("nbrFollow"));

          

           this.retweetWorker(30);

       }

       static retweetWorker(max){
        var compteur = 0;
        var interval = setInterval(function(compteur){
          if(this.fol > 100)
            clearInterval(interval);
          Lazy.delay(function(){
            this.retweeter();
           }.bind(this),2000);
           Lazy.delay(function(){
            this.valideRetweet();
           }.bind(this),7000);
           compteur++;
           console.log(this.fol);
           if(this.fol > 70){
              document.location.reload(true);
              this.fol = 1;
           }

          }.bind(this),10000);
        }

       static recupeTendance(){
        var tendanceArray = [];
        let compt = 1;
        while(compt < 11){
            let pathF= '//*[@id="page-container"]/div[1]/div[2]/div/div/div[2]/ul/li['+compt+']/a/span';
            //*[@id="page-container"]/div[1]/div[2]/div/div/div[2]/ul/li[2]/a/span
            console.log(pathF);
            let trend = new xph().ctx(document).craft(pathF).firstResult();
            tendanceArray.push(trend.innerHTML);
            //this.click(trend, function(result) {}.bind(this));
             
            compt++;
        }
        return tendanceArray;
       }


       /**
        * @method actionSuccessive: démonstration du bot
        */

       static actionSuccessive() {
           setTimeout(this.actionTweet("tweeter", "premier"), 2000);
           setTimeout(this.actionTweet("commenter", "second"), 5000);

       }

       /**
        * @method actionTweet: réalise une action du bot
        * @param {string} action: action à effectuer
        * @param {string} message: message à transmettre
        */


       static actionTweet(action, message) {

           console.log("action: " + action);
           this.message = message;
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
           //this.follow();
           this.actionTweet("tweeter", "premier");

           // type here
       }

       static onClosePopup() { // called when popup is closed
           super.onClosePopup(); // do not remove

           trace("custom popup close");
           // type here
       }

   }

   liftoff(CustomExtensionContent); // do not remove