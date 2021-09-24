import { normalizeFrameNumber, calculateFullAnimationDuration } from "./utils";
import { validateInitParameters, getDefaultSettings } from "./settings";
import { startLoadingImages } from "./preload";
import { maybeShowPoster } from "./poster";
import { clearCanvas, drawFrame } from "./render";

/**
 * @param {Element|HTMLCanvasElement} node - Canvas DOM Node
 * @param {Object} options - Options
 * @param {Array} options.images - Array with images URLs (required)
 * @param {String} [options.preload="all"] - Preload mode ("all", "none", "partial")
 * @param {Number} [options.preloadNumber=0] - Number of preloaded images for option.preload="partial", 0 for all
 * @param {Number} [options.fps=30] - FPS when playing
 * @param {String} options.poster - Url of a poster image, to show before load
 * @param {Boolean} [options.draggable = false] - Draggable by mouse or touch
 * @param {Boolean} [options.loop=false] - Whether to start a new cycle at the end
 * @param {Boolean} [options.reverse=false] - Reverse direction
 * @param {Boolean} [options.autoplay=false] - Autoplay
 * @param {Number} options.ratio - Canvas width/height ratio, it takes precedence over inline canvas width and height
 * @param {String} [options.fillMode="cover"] - Fill mode to use if canvas and image aspect ratios are different. Could be "cover" or "contain"
 * @param {Function} options.onPreloadFinished - Occurs when all image files have been loaded
 * @param {Function} options.onPosterLoaded - Occurs when poster image is fully loaded
 */
export function init(node, options = {}) {
    validateInitParameters(node, options);
    let settings = {...getDefaultSettings(), ...options};

    let data = {
        currentFrame: 1,
        isAnimating: false,
        totalImages: options.images.length,
        loadedImagesArray: [], // images objects [0 - (images.length-1)]
        deferredAction: null, // call after full preload
        isAnyFrameChanged: false,
        animation: {
            lastUpdate: 0, //time from RAF
            duration: calculateFullAnimationDuration(settings),// time of the full animation sequence
            framesLeftToPlay: undefined, // frames from playTo() and playFrames()
            deltaFrames: 1, // frame change step
            animationPromise: null,
            animationPromiseResolve: null,
            stopRequested: false,
        },
        poster: {
            imageObject: null,
            isPosterLoaded: false,
        },
        load: {
            isPreloadFinished: false, // onload on all the images
            preloadOffset: 0, // images already in queue
            preloadedImagesNumber: 0, // count of loaded images
            isLoadWithErrors: false,
            onLoadFinishedCB: afterPreloadFinishes,
        },
        canvas: {
            element: node,
            /** @type CanvasRenderingContext2D */
            context: null,
            ratio: null,
            imageWidth: 0,
            imageHeight: 0,
        }
    }

    function setupCanvas(){
        console.log('setup canvas');
        /**
         * <canvas width="" height=""> влияет на ratio, по дефолту 2:1
         * Если указать то ratio = width/height; если нет то берётся options.ratio, если не указано ничего то дефолт 2:1
         * Размеры canvas управляется через CSS, при создании внутренний размер будет изменён на реальный размер, учитывая ratio
         * ratio не будет учитываться если height фиксирована в CSS, произойдёт перерасчёт под реальною высоту
         * !! изменение width и height не изменяет реальные clientWidth и clientHeight если размер фиксирован в CSS!!
         */
        data.canvas.context = data.canvas.element.getContext("2d");
        if ( settings.ratio ) data.canvas.ratio = settings.ratio;
        else  data.canvas.ratio = data.canvas.element.width / data.canvas.element.height

        //ratio = 3;
        console.log(`default width: ${data.canvas.element.width}, default height: ${data.canvas.element.height}` );
        console.log(`ratio ${data.canvas.ratio}`);
        data.canvas.element.width = data.canvas.element.clientWidth;
        data.canvas.element.height = data.canvas.element.width / data.canvas.ratio;

        console.log(`!!height ${data.canvas.element.height}, clientHeight ${data.canvas.element.clientHeight}`);
        if (data.canvas.element.height !== data.canvas.element.clientHeight) { // if height set by CSS
            console.log('not equal height');
            data.canvas.element.height = data.canvas.element.clientHeight;
            data.canvas.ratio = data.canvas.element.width / data.canvas.element.height;
            console.log(`new adjusted ratio ${data.canvas.ratio}`);
        }
        console.log(`after height ${data.canvas.element.clientHeight}`);
        /** Если нет фиксированной CSS высоты (изменение height меняет clientHeight)
         *      если указан options.ratio то берётся CSS ширина и ставиться в ширину, и через неё и ratio
         *        ставиться высота, canvas будет точно таким
         *      если нет options.ratio, берётся width/height либо 2:1, через CSS ширину считается высота
         *  Если CSS высота фиксирована то изменение height не меняет clientHeight
         *      высота внутри canvas указывается как clientHeight (CSS)
         *      рассчитывается новый реальный ratio
         */
    }
    function log(){
        //data.canvas.element.width = 1200;
        console.dir(data.canvas.element);
        console.log(`width: ${data.canvas.element.width}, height: ${data.canvas.element.height}` );
        console.log(`clientWidth: ${data.canvas.element.clientWidth}, clientHeight: ${data.canvas.element.clientHeight}` );
        console.log(`offsetWidth: ${data.canvas.element.offsetWidth}, offsetHeight: ${data.canvas.element.offsetHeight}` );
        //console.log(`offsetLeft: ${data.canvas.element.offsetLeft}, offsetTop: ${data.canvas.element.offsetTop}` );

        let img = data.loadedImagesArray[0];
        console.dir(img);
        console.log(`width: ${img.width}, height: ${img.height}` );
        console.log(`naturalWidth: ${img.naturalWidth}, naturalHeight: ${img.naturalHeight}` );
    }

    function changeFrame(frameNumber){
        console.log(`change frame to ${frameNumber}`);

        if (frameNumber === data.currentFrame && data.isAnyFrameChanged) return;//skip same frame, except first draw
        if ( !data.isAnyFrameChanged ) data.isAnyFrameChanged = true;

        animateCanvas(frameNumber);
        if (typeof data.animation.framesLeftToPlay !== 'undefined') {
            data.animation.framesLeftToPlay = data.animation.framesLeftToPlay - data.animation.deltaFrames;
        }
        data.currentFrame = frameNumber;
    }

    // works inside RAF
    function animate(time){
        //console.log(`animate`);
        console.log(`animate framesLeftToPlay ${data.animation.framesLeftToPlay}`);
        // if 0 frames left, stop immediately, don't wait for the next frame calculation
        // because if isAnimating become true, this will be a new animation
        if ( typeof data.animation.framesLeftToPlay !== 'undefined' && data.animation.framesLeftToPlay <= 0)
            plugin.stop();
        if ( !data.isAnimating ) return;

        const progress = ( time - data.animation.lastUpdate ) / data.animation.duration; // ex. 0.01
        const deltaFrames = progress * data.totalImages; // Ex. 0.45 or 1.25

        if ( deltaFrames >= 1) { // Animate only if we need to update 1 frame or more
            // calculate next frame only when we want to render
            // if the getNextFrame check was outside, getNextFrame would be called at screen fps rate, not animation fps
            // if screen fps 144 and animation fps 30, getNextFrame is calling now 30/s instead of 144/s,
            // so after the last frame, raf is repeating until the next frame calculation
            // Between the last frame drawing and new frame time, reverse or loop could be changed, and animation won't stop
            let newFrame = getNextFrame( Math.floor(deltaFrames) );
            if ( data.animation.stopRequested ) { // animation ended from check in getNextFrame()
                plugin.stop();
                data.animation.stopRequested = false;
            } else { // animation on
                //todo поставить time вместо performance.now() и затестить
                data.animation.lastUpdate = performance.now();// time update should be before
                changeFrame(newFrame);
            }
        }
        if ( data.isAnimating ) requestAnimationFrame(animate);
    }

    function getNextFrame(deltaFrames, reverse){
        deltaFrames = deltaFrames%data.totalImages;// handle if deltaFrames > totalImages
        data.animation.deltaFrames = deltaFrames;// it's using in changeFrame to recalculate framesLeftToPlay
        // Handle reverse
        if ( reverse === undefined ) reverse = settings.reverse;
        let newFrameNumber = (reverse) ? data.currentFrame - deltaFrames : data.currentFrame + deltaFrames;

        // Handle loop
        if (settings.loop) { // loop and outside of the frames
            if (newFrameNumber <= 0) {
                // ex. newFrame = -2, total = 50, newFrame = 50 - abs(-2) = 48
                newFrameNumber = data.totalImages - Math.abs(newFrameNumber);
            }
            else if (newFrameNumber > data.totalImages) {
                //ex. newFrame = 53, total 50, newFrame = newFrame - totalFrames = 53 - 50 = 3
                newFrameNumber = newFrameNumber - data.totalImages;
            }
        } else { // no loop and outside of the frames
            if (newFrameNumber <= 0) {
                newFrameNumber = 1;
                data.animation.stopRequested = true;
            }
            else if (newFrameNumber > data.totalImages) {
                newFrameNumber = data.totalImages;
                data.animation.stopRequested = true;
            }
        }

        return  newFrameNumber;
    }

    function animateCanvas(frameNumber){
        clearCanvas(data);
        drawFrame(frameNumber, {settings, data});
    }


    function initPlugin(){
        console.log('init');
        setupCanvas();
        data.animation.lastUpdate = performance.now();
        maybeShowPoster({settings, data, drawFrame});
        if (settings.preload === 'all' || settings.preload === "partial"){
            let preloadNumber = (settings.preload === 'all') ? data.totalImages : settings.preloadNumber;
            if (preloadNumber === 0) preloadNumber = data.totalImages;
            startLoadingImages(preloadNumber, { settings, data });
        }
        if (settings.autoplay) plugin.play();

    }
    function afterPreloadFinishes(){ // check what to do next
        console.log('preload finished');

        data.canvas.imageWidth = data.loadedImagesArray[0].naturalWidth;
        data.canvas.imageHeight = data.loadedImagesArray[0].naturalHeight;

        node.dispatchEvent( new Event('animate-images:preload-finished') );
        if ("onPreloadFinished" in settings) settings.onPreloadFinished(plugin);
        if (data.deferredAction) data.deferredAction();
        log();
    }


    // Pubic API
    let plugin = {
        play(){
            console.log('play');
            if ( data.isAnimating ) return;
            if (data.load.isPreloadFinished) {
                data.isAnimating = true;
                // 1st draw, direct call because 1st frame wasn't drawn
                if ( !data.isAnyFrameChanged ) changeFrame(1);
                data.animation.lastUpdate = performance.now();
                requestAnimationFrame(animate);
            } else {
                data.deferredAction = plugin.play;
                startLoadingImages(data.totalImages, { settings, data });
            }
            return this;
        },
        stop(){
            console.log('stop');
            if ( data.isAnimating ){
                console.log('animation end event');
                node.dispatchEvent( new Event('animate-images:animation-end') );
                if (typeof data.animation.animationPromiseResolve === 'function') data.animation.animationPromiseResolve(this);
            }
            data.isAnimating = false;
            data.animation.framesLeftToPlay = undefined;
            data.animation.animationPromise = null;
            return this;
        },
        togglePlay(){
            console.log('toggled');
            if ( !data.isAnimating ) plugin.play();
            else plugin.stop();
            return this;
        },
        next(){
            console.log('next frame');
            if (data.load.isPreloadFinished) {
                plugin.stop();
                changeFrame( getNextFrame(1) );
            } else {
                data.deferredAction = plugin.next;
                startLoadingImages(data.totalImages, { settings, data });
            }
            return this;
        },
        prev(){
            console.log('prev frame');
            if (data.load.isPreloadFinished) {
                plugin.stop();
                changeFrame( getNextFrame(1, !settings.reverse) );
            } else {
                data.deferredAction = plugin.prev;
                startLoadingImages(data.totalImages, { settings, data });
            }
            return this;
        },
        setFrame(frameNumber){
            console.log('set frame ' + frameNumber);

            if (data.load.isPreloadFinished) {
                plugin.stop();
                changeFrame(normalizeFrameNumber(frameNumber, data.totalImages));
            } else {
                data.deferredAction = plugin.setFrame.bind(this, frameNumber);
                startLoadingImages(data.totalImages, { settings, data });
            }
            return this;
        },
        playTo(frameNumber){
            console.log('playTo ' + frameNumber);
            if (data.load.isPreloadFinished) {
                frameNumber = normalizeFrameNumber(frameNumber, data.totalImages);
                //if (data.currentFrame === frameNumber) return;

                if (frameNumber > data.currentFrame)   plugin.setReverse(false); // move forward
                else  plugin.setReverse(true); // move backward

                data.animation.animationPromise = plugin.playFrames(Math.abs(frameNumber - data.currentFrame))
            } else {
                data.deferredAction = plugin.playTo.bind(this, frameNumber);
                startLoadingImages(data.totalImages, { settings, data });
            }

            if ( !data.animation.animationPromise ) data.animation.animationPromise =new Promise((resolve, reject)=>{
                data.animation.animationPromiseResolve = resolve;
            });
            return data.animation.animationPromise;
        },
        playFrames(numberOfFrames = 0){
            console.log('   playFrames ' + numberOfFrames);
            if (data.load.isPreloadFinished) {
                numberOfFrames = Math.floor(numberOfFrames);
                if (numberOfFrames < 0) return new Promise((resolve)=> { resolve(this)}); //empty animation

                // if this is the 1st animation, we should add 1 frame to the queue to draw the 1st initial frame
                // because 1st frame is not drawn by default
                if (!data.isAnyFrameChanged) numberOfFrames += 1;
                if (numberOfFrames <= 0) return new Promise((resolve)=> { resolve(this)}); //empty animation

                data.animation.framesLeftToPlay = numberOfFrames;
                plugin.play();

            } else {
                data.deferredAction = plugin.playTo.bind(this, numberOfFrames);
                startLoadingImages(data.totalImages, { settings, data });
            }

            if ( !data.animation.animationPromise ) data.animation.animationPromise =new Promise((resolve, reject)=>{
                data.animation.animationPromiseResolve = resolve;
            });
            return data.animation.animationPromise;
        },
        setReverse(reverse = true){
            settings.reverse = !!reverse;
            return this;
        },
        preloadImages(number){
            number = number ?? data.totalImages;
            startLoadingImages(number, { settings, data });
            return this;
        },
        reset(){
            console.log('reset');
            if (data.load.isPreloadFinished) {
                plugin.stop();
                changeFrame(normalizeFrameNumber(1, data.totalImages));
            } else {
                data.deferredAction = plugin.reset;
                startLoadingImages(data.totalImages, { settings, data });
            }
            return this;
        },

        setOption: (option, value) => {
            const allowedOptions = ['fps', 'draggable', 'loop', 'reverse', 'poster'];
            if (allowedOptions.includes(option)) {
               settings[option] = value;
               if (option === 'poster') maybeShowPoster({settings, data, drawFrame});
               if (option === 'fps') data.animation.duration = calculateFullAnimationDuration(settings);
            } else {
                console.warn(`${option} is not allowed in setOption`);
            }
        },
        getOption: (option) => {
            const allowedOptions = ['fps', 'draggable', 'loop', 'reverse', 'poster', 'autoplay'];
            if (allowedOptions.includes(option)) {
                return settings[option];
            } else {
                console.warn(`${option} is not allowed in getOption`);
            }
        },
        getCurrentFrame: () => data.currentFrame,
        getTotalImages:() => data.totalImages,
        isAnimating: () => data.isAnimating,
        isPreloadFinished: () => data.load.isPreloadFinished,
        isLoadWithErrors: () => data.load.isLoadWithErrors,
        isPosterLoaded: () => data.poster.isPosterLoaded,
        destroy(){
            console.log('destroy');
        }
    };

    initPlugin();
    return plugin;
}
