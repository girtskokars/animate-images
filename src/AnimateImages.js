import { normalizeFrameNumber } from "./utils";
import { validateInitParameters, defaultSettings } from "./settings";
import ImagePreloader from "./ImagePreloader";
import Render from "./Render";
import Animation from "./Animation";
import Poster from "./Poster";
import DragInput from "./DragInput";

/**
 * Animate Images {@link https://github.com/its2easy/animate-images/}
 * @example
 * let pluginInstance = new AnimateImages(document.querySelector('canvas'), {
 *    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
 *    loop: true,
 *    draggable: true,
 *    fps: 60,
 * });
 */
export default class AnimateImages{
    #settings;
    #data = {
        currentFrame: 1,
        totalImages: null,
        loadedImagesArray: [], // images objects [0 - (images.length-1)]
        deferredAction: null, // call after full preload
        isAnyFrameChanged: false,
        /** @type AnimateImages */
        pluginApi: undefined,
        canvas: {
            element: null,
            ratio: null,
        },
    }
    #boundUpdateCanvasSizes;
    //Classes
    #preloader;
    #render;
    #animation;
    #poster;
    #dragInput;

    /**
     * Creates plugin instance
     * @param {HTMLCanvasElement} node - canvas element
     * @param {PluginOptions} options
     */
    constructor(node, options){
        validateInitParameters(node, options);
        this.#settings = {...defaultSettings, ...options};
        this.#data.totalImages = options.images.length;
        this.#data.canvas.element = node;
        this.#data.pluginApi = this;
        this.#boundUpdateCanvasSizes = this.#updateCanvasSizes.bind(this)
        this.#initPlugin();
    }

    #initPlugin(){
        this.#render = new Render( {settings: this.#settings, data: this.#data} );
        this.#animation = new Animation(
            {settings: this.#settings, data: this.#data, changeFrame:  this.#changeFrame.bind(this)} );
        this.#updateCanvasSizes();
        if ( this.#settings.poster ) this.#setupPoster();
        this.#toggleResizeHandler(true);
        this.#preloader = new ImagePreloader({
            settings: this.#settings,
            data: this.#data,
            updateImagesCount: this.#updateImagesCount.bind(this),
        });
        if (this.#settings.preload === 'all' || this.#settings.preload === "partial"){
            let preloadNumber = (this.#settings.preload === 'all') ? this.#data.totalImages : this.#settings.preloadNumber;
            if (preloadNumber === 0) preloadNumber = this.#data.totalImages;
            this.#preloader.startLoadingImages(preloadNumber);
        }
        if (this.#settings.autoplay) this.play();
        if ( this.#settings.draggable ) this.#toggleDrag(true);
    }

    #changeFrame(frameNumber){
        if (frameNumber === this.#data.currentFrame && this.#data.isAnyFrameChanged) return;//skip same frame, except first drawing
        if ( !this.#data.isAnyFrameChanged ) this.#data.isAnyFrameChanged = true;

        this.#animateCanvas(frameNumber);
        this.#data.currentFrame = frameNumber;
    }

    #animateCanvas(frameNumber){
        this.#render.clearCanvas();
        this.#render.drawFrame(frameNumber);
    }


    #updateCanvasSizes(){
        /**
         * If no options.ratio, inline canvas width/height will be used (2:1 if not set)
         * Real canvas size is controlled by CSS, inner size will be set based on CSS width and ratio (height should be "auto")
         * If height if fixed in CSS, ratio can't be used and inner height will be equal to CSS-defined height
         */
        if ( this.#settings.ratio ) this.#data.canvas.ratio = this.#settings.ratio;
        // Initial ratio shouldn't be changed. Ratio will only modified after setOption("ratio", newRatio),
        // or after setting css height and plugin.updateCanvas()
        else if ( !this.#data.canvas.ratio ) {
            this.#data.canvas.ratio = this.#data.canvas.element.width / this.#data.canvas.element.height;
        }

        let dpr = window.devicePixelRatio || 1;
        // changing width and height won't change real clientWidth and clientHeight if size is fixed by CSS
        let initialClientWidth = this.#data.canvas.element.clientWidth;
        this.#data.canvas.element.width = this.#data.canvas.element.clientWidth * dpr;
        // if canvas css width was not defined, clientWidth was changed based on new width, we need to recalculate width based on new clientWidth
        if (initialClientWidth !== this.#data.canvas.element.clientWidth) {
            this.#data.canvas.element.width = this.#data.canvas.element.clientWidth * dpr;
        }
        this.#data.canvas.element.height = Math.round(this.#data.canvas.element.clientWidth / this.#data.canvas.ratio) * dpr; // "round" for partial fix to rounding pixels error

        let heightDifference = Math.abs(this.#data.canvas.element.height - this.#data.canvas.element.clientHeight * dpr);// diff in pixels
        if ( heightDifference >= 1) { // if height set by CSS
            this.#data.canvas.element.height = this.#data.canvas.element.clientHeight * dpr;
            this.#data.canvas.ratio = this.#data.canvas.element.width / this.#data.canvas.element.height;
        } else if (heightDifference > 0 && heightDifference <1 ) { // rare case, height is auto, but pixels are fractional
            this.#data.canvas.element.height = this.#data.canvas.element.clientHeight * dpr; // so just update inner canvas size baser on rounded real height
        }

        if ( this.#dragInput ) this.#dragInput.updateThreshold()
        this.#maybeRedrawFrame(); // canvas is clear after resize
    }

    #updateImagesCount(){
        if ( this.#dragInput ) this.#dragInput.updateThreshold();
        this.#animation.updateDuration();
    }
    #maybeRedrawFrame(){
        if ( this.#data.isAnyFrameChanged ) { // frames were drawn
            this.#animateCanvas(this.#data.currentFrame);
        } else if ( this.#poster ) { // poster exists
            this.#poster.redrawPoster();
        }
        // don't redraw in initial state, or if poster onLoad is not finished yet
    }

    #toggleDrag(enable){
        if (enable) {
            if ( !this.#dragInput ) this.#dragInput = new DragInput({
                data: this.#data,
                settings: this.#settings,
                changeFrame: this.#changeFrame.bind(this),
                getNextFrame: this.#animation.getNextFrame.bind(this.#animation)
            });
            this.#dragInput.enableDrag();
        } else {
            if (this.#dragInput) this.#dragInput.disableDrag();
        }
    }

    #setupPoster(){
        if (!this.#poster) this.#poster = new Poster(
            {
                settings: this.#settings,
                data: this.#data,
                drawFrame: this.#render.drawFrame.bind(this.#render)
            });
        this.#poster.loadAndShowPoster();
    }

    #toggleResizeHandler(add = true) {
        if ( add ) window.addEventListener("resize", this.#boundUpdateCanvasSizes);
        else window.removeEventListener("resize", this.#boundUpdateCanvasSizes);
    }

    // Pubic API

    /**
     * Start animation
     * @returns {AnimateImages} - plugin instance
     */
    play(){
        if ( this.#animation.isAnimating ) return this;
        if ( this.#preloader.isPreloadFinished ) {
            this.#animation.play();
        } else {
            this.#data.deferredAction = this.play.bind(this);
            this.#preloader.startLoadingImages();
        }
        return this;
    }
    /**
     * Stop animation
     * @returns {AnimateImages} - plugin instance
     */
    stop(){
        this.#animation.stop();
        return this;
    }
    /**
     * Toggle between start and stop
     * @returns {AnimateImages} - plugin instance
     */
    toggle(){
        if ( !this.#animation.isAnimating ) this.play();
        else this.stop();
        return this;
    }
    /**
     * Show next frame
     * @returns {AnimateImages} - plugin instance
     */
    next(){
        if ( this.#preloader.isPreloadFinished ) {
            this.stop();
            this.#changeFrame( this.#animation.getNextFrame(1) );
        } else {
            this.#data.deferredAction = this.next.bind(this);
            this.#preloader.startLoadingImages();
        }
        return this;
    }
    /**
     * Show previous frame
     * @returns {AnimateImages} - plugin instance
     */
    prev(){
        if ( this.#preloader.isPreloadFinished ) {
            this.stop();
            this.#changeFrame( this.#animation.getNextFrame(1, !this.#settings.reverse) );
        } else {
            this.#data.deferredAction = this.prev.bind(this);
            this.#preloader.startLoadingImages();
        }
        return this;
    }
    /**
     * Show a frame with a specified number (without animation)
     * @param {number} frameNumber - Number of the frame to show
     * @returns {AnimateImages} - plugin instance
     */
    setFrame(frameNumber){
        if ( this.#preloader.isPreloadFinished ) {
            this.stop();
            this.#changeFrame(normalizeFrameNumber(frameNumber, this.#data.totalImages));
        } else {
            this.#data.deferredAction = this.setFrame.bind(this, frameNumber);
            this.#preloader.startLoadingImages();
        }
        return this;
    }
    /**
     * Start animation, that plays until the specified frame number
     * @param {number} frameNumber - Target frame number
     * @returns {AnimateImages} - plugin instance
     */
    playTo(frameNumber){
        frameNumber = normalizeFrameNumber(frameNumber, this.#data.totalImages);
        if (frameNumber > this.#data.currentFrame)   this.setReverse(false); // move forward
        else  this.setReverse(true); // move backward

        let numberOfFramesToPlay = Math.abs(frameNumber - this.#data.currentFrame);

        if (this.#settings.loop && numberOfFramesToPlay > this.#data.totalImages / 2) {
          // take the shortest path
          if (this.#data.currentFrame > frameNumber) {
            numberOfFramesToPlay = (this.#data.totalImages - this.#data.currentFrame) + frameNumber;
            this.setReverse(false);
          } else {
            numberOfFramesToPlay = (this.#data.totalImages - frameNumber) + this.#data.currentFrame;
            this.setReverse(true);
          }
        }

        return this.playFrames(numberOfFramesToPlay);
    }
    /**
     * Start animation in the current direction with the specified number of frames in the queue
     * @param {number} [numberOfFrames=0] - Number of frames to play
     * @returns {AnimateImages} - plugin instance
     */
    playFrames(numberOfFrames = 0){
        if ( this.#preloader.isPreloadFinished ) {
            numberOfFrames = Math.floor(numberOfFrames);
            if (numberOfFrames < 0) { // first frame should be rendered to replace poster or transparent bg, so allow 0 for the first time
                return this.stop(); //empty animation, stop() to trigger events and callbacks
            }

            // if this is the 1st animation, we should add 1 frame to the queue to draw the 1st initial frame
            // because 1st frame is not drawn by default (1 frame will replace poster or transparent bg)
            if (!this.#data.isAnyFrameChanged) numberOfFrames += 1;
            if (numberOfFrames <= 0) { // with playFrames(0) before any actions numberOfFrames=1, after any frame change numberOfFrames=0
                return this.stop(); //empty animation
            }

            this.#animation.framesLeftToPlay = numberOfFrames;
            this.play();
        } else {
            this.#data.deferredAction = this.playFrames.bind(this, numberOfFrames);
            this.#preloader.startLoadingImages();
        }
        return this;
    }
    /**
     * Change the direction of the animation. Alias to <b>setOption('reverse', true)</b>
     * @param {boolean} [reverse=true] - True for backward animation, false for forward
     * @returns {AnimateImages} - plugin instance
     */
    setReverse(reverse = true){
        this.#settings.reverse = !!reverse;
        return this;
    }
    /** Get current reverse option. Alias to <b>getOption('reverse')</b>
     * @returns {boolean} - reverse or not
     */
    getReverse() { return this.#settings.reverse; }
    /**
     * Start preload specified number of images, can be called multiple times.
     * If all the images are already loaded, then nothing will happen
     * @param {number} number - Number of images to load. If not specified, all remaining images will be loaded.
     * @returns {AnimateImages} - plugin instance
     */
    preloadImages(number= undefined){
        number = number ?? this.#data.totalImages;
        this.#preloader.startLoadingImages(number);
        return this;
    }
    /**
     * Calculate new canvas dimensions. Should be called after the canvas size was changed manually
     * Called automatically after page resize
     * @returns {AnimateImages} - plugin instance
     */
    updateCanvas(){
        this.#updateCanvasSizes();
        return this;
    }
    /**
     * Returns option value
     * @param {string} option - Option name. All options are allowed
     * @returns {*} - Current option value
     */
    getOption(option){
        if ( option in this.#settings ) {
            return this.#settings[option];
        } else {
            console.warn(`${option} is not a valid option`);
        }
    }
    /**
     * Set new option value
     * @param {string} option - Option name. Allowed options: fps, loop, reverse, inversion, ratio, fillMode, draggable, dragModifier,
     * touchScrollMode, pageScrollTimerDelay, onPreloadFinished, onPosterLoaded, onAnimationEnd, onBeforeFrame, onAfterFrame
     * @param {*} value - New value
     * @returns {AnimateImages} - plugin instance
     */
    setOption(option, value) {
        const allowedOptions = ['fps', 'loop', 'reverse', 'inversion', 'ratio', 'fillMode', 'draggable', 'dragModifier', 'touchScrollMode',
            'pageScrollTimerDelay', 'onPreloadFinished', 'onPosterLoaded', 'onAnimationEnd', 'onBeforeFrame', 'onAfterFrame'];
        if (allowedOptions.includes(option)) {
           this.#settings[option] = value;
           if (option === 'fps') this.#animation.updateDuration();
           if (option === 'ratio') this.#updateCanvasSizes();
           if (option === 'fillMode') this.#updateCanvasSizes();
           if (option === 'draggable') this.#toggleDrag(value);
           if (option === 'dragModifier') this.#settings.dragModifier = Math.abs(+value);
        } else {
            console.warn(`${option} is not allowed in setOption`);
        }
        return this;
    }
    /** @returns {number} - current frame number */
    getCurrentFrame() { return this.#data.currentFrame }
    /** @returns {number} - total frames (considering loading errors) */
    getTotalImages() { return this.#data.totalImages }
    /** @returns {number} - current canvas ratio */
    getRatio() { return this.#data.canvas.ratio }
    /** @returns {boolean} - animating or not */
    isAnimating() { return this.#animation.isAnimating }
    /** @returns {boolean} - is preload finished */
    isPreloadFinished() { return this.#preloader.isPreloadFinished }
    /** @returns {boolean} - is loaded with errors */
    isLoadedWithErrors() { return this.#preloader.isLoadedWithErrors }

    /**
     * Stop the animation and return to the first frame
     * @returns {AnimateImages} - plugin instance
     */
    reset(){
        if ( this.#preloader.isPreloadFinished ) {
            this.stop();
            this.#changeFrame(normalizeFrameNumber(1, this.#data.totalImages));
        } else {
            this.#data.deferredAction = this.reset.bind(this);
            this.#preloader.startLoadingImages();
        }
        return this;
    }
    /**
     * Stop animation, remove event listeners and clear the canvas. Method doesn't remove canvas element from the DOM
     */
    destroy(){
        this.stop();
        this.#render.clearCanvas();
        this.#toggleDrag(false);
        this.#toggleResizeHandler(false);
    }
}


/**
 * @typedef {Object} PluginOptions
 * @property {Array<string>} images - Array with images URLs (required)
 * @property {'all'|'partial'|'none'} [preload="all"] - Preload mode ("all", "none", "partial")
 * @property {number} [preloadNumber=0] - Number of preloaded images when <b>preload: "partial"</b>, 0 for all
 * @property {string} [poster] - Url of a poster image, to show before load
 * @property {number} [fps=30] - FPS when playing. Determines the duration of the animation (for example 90 images and 60
 * fps = 1.5s, 90 images and 30fps = 3s)
 * @property {boolean} [loop=false] - Loop the animation
 * @property {boolean} [autoplay=false] - Autoplay
 * @property {boolean} [reverse=false] - Reverse direction
 * reverse means forward or backward, and inversion determines which direction is forward. Affects animation and drag
 * @property {number} [ratio] - Canvas width/height ratio, it has higher priority than inline canvas width and height
 * @property {'cover'|'contain'} [fillMode="cover"] - Fill mode to use if canvas and image aspect ratios are different
 * ("cover" or "contain")
 * @property {boolean} [draggable=false] - Draggable by mouse or touch
 * @property {boolean} [inversion=false] - Inversion changes drag direction
 * @property {number} [dragModifier=1] - Sensitivity factor for user interaction. Only positive numbers are allowed
 * @property {'pageScrollTimer' | 'preventPageScroll' | 'allowPageScroll'} [touchScrollMode = "pageScrollTimer"] - Page
 * scroll behavior with touch events (preventPageScroll,allowPageScroll, pageScrollTimer)
 * @property {number} [pageScrollTimerDelay=1500] - Time in ms when touch scroll will be disabled during interaction
 * if <b>touchScrollMode: "pageScrollTimer"<b>
 * @property {function(AnimateImages):void} [onPreloadFinished] - Occurs when all image files have been loaded
 * @property {function(AnimateImages):void} [onPosterLoaded] - Occurs when poster image is fully loaded
 * @property {function(AnimateImages):void} [onAnimationEnd] - Occurs when animation has ended
 * @property {function(AnimateImages, FrameInfo):void} [onBeforeFrame] - Occurs before new frame
 * @property {function(AnimateImages, FrameInfo):void} [onAfterFrame] - Occurs after the frame was drawn
 */

/**
 * @typedef {Object} FrameInfo
 * @property {CanvasRenderingContext2D} context - canvas context
 * @property {number} width - internal canvas width
 * @property {number} height - internal canvas height
 * */
