<h1 align="center">
   AnimateImages
</h1>

![npm](https://img.shields.io/npm/v/@its2easy/animate-images)

Demo - [codepen](https://codepen.io/its2easy/pen/powQJmd)

**AnimateImages** is a lightweight library (18kb) that animates a sequence of images 
to use in animations or pseudo 3d product view. It works WITHOUT BUILT-IN UI and mainly 
developed for complex animations.

To use it, you have to get a series of frames from a video or 3d app. 
The frames must be separate images of the same size.

* [Installation](#installation)
* [Usage](#usage)
* [Options](#options)
* [Methods](#methods)
* [Events](#events)
* [Browser support](#browser_support)
* [License](#license)

## <a name="installation"></a>Installation
### Browser script tag
Add with CDN link:
```html
<script src="https://cdn.jsdelivr.net/npm/@its2easy/animate-images"></script>
```
Or download <a href="https://unpkg.com/@its2easy/animate-images">minified version</a>
 and include in html:
```html
<script src="animate-images.umd.min.js"></script>
```
```javascript
let instance = new AnimateImages(element, options);
```
### npm
```
npm i @its2easy/animate-images --save
```
```javascript
import AnimateImages from "@its2easy/animate-images";
let instance = new AnimateImages(element, options);
```

It is possible to directly import untranspiled esm version, which is smaller:
```javascript
import AnimateImages from '@its2easy/animate-images/build/untranspiled/animate-images.esm.min.js'; //or animate-images.esm.js
```
> :warning: You should probably add it to your build process if you use untranspiled version. Example for webpack:
```javascript
rules: [
    {
        test: /\.js$/,
        exclude: /node_modules(?!(\/|\\)@its2easy(\/|\\)animate-images(\/|\\)build)/,
        use: {
            loader: 'babel-loader',
        }
    }
]
```
or
```javascript
rules: [
    {
        // basic js rule
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
            loader: 'babel-loader',
        }
    },
    {
        // additional rule
        test: /\.js$/,
        include: /node_modules(\/|\\)@its2easy(\/|\\)animate-images(\/|\\)build/,
        use: {
            loader: 'babel-loader',
        }
    },
]
```
#### All available versions:
umd build:

`@its2easy/animate-images/build/animate-images.umd.min.js` - default for browser script tag and legacy bundlers

esm builds processed whit babel:

`@its2easy/animate-images/build/animate-images.esm.min.js` - default for webpack and module environments

`@its2easy/animate-images/build/animate-images.esm.js`

esm builds without babel transformation:

`@its2easy/animate-images/build/untranspiled/animate-images.esm.min.js`

`@its2easy/animate-images/build/untranspiled/animate-images.esm.js`

:information_source: If you are using **webpack 4** and babel with modern target browsers,
then you might get an error while importing, because webpack 4 doesn't support some modern js
syntax and babel doesn't transpile it because browsers support for this syntax is high enough now.
Use **webpack 5** to fix it.

## <a name="usage"></a>Usage
Create canvas element 
```html
 <canvas class="canvas_el" width="800" height="500"></canvas>
```

Initialize with options
```javascript
let element = document.querySelector('canvas.canvas-el');
let imagesArray = Array.from(new Array(90), (v, k) => { // generate array of urls
    let number = String(k).padStart(4, "0");
    return `path/to/your/images/frame-${number}.jpg`;
});
let instance = new AnimateImages(element, {
    images: imagesArray, /* required */
    preload: "partial",
    preloadNumber: 20,
    loop: true,
    fps: 60,
    poster: 'path/to/poster/image.jpg',
});
instance.play();
```

Methods called from `onPreloadFinished` callback will start immediately, but you have to use `options.preload: 'all'`
or call `plugin.preload()`. The plugin loads each image only once, so it's safe to call `preload` multiple times, 
even after the load has been completed. If `autoplay: true`, full preload will start immediately.
```javascript
let instance = new AnimateImages(element, {
    images: imagesArray, /* required */
    preload: "none", // if 'all', you don't need to call preload()
    onPreloadFinished: function (plugin){
        plugin.play();
    }
});
instance.preload(30);//load the first part

setTimeout(() => {
    instance.preload(60);// laod the rest
}, 1000);
// or instance.preload() to load all the images
```
Methods that were called from outside of `onPreloadFinished` will trigger the load of all remaining images, 
wait for the full load, and then execute the action. If multiple methods have been called before 
load, only the last will be executed
```javascript
let instance = animateImages.init(element,
    {
        images: imagesArray,
        preload: "none", 
    }
);
// if preload: "none", it will trigger the load, and play after all the image loaded
// if preload: "all", it will wait until full load and then start
instance.play(); 
```
In general, the plugin will load all the frames before any action, but you can preload a part of the 
images in some cases, for example, when the user is scrolling to the section in which the animation will 
take place.

### Sizes and responsive behavior
The width of the canvas is defined by page CSS. To calculate height, plugin uses ratio of
inline width and height canvas properties `<canvas width="1600" height="900">` (if they're not set, default
 is 300x150). This ratio can be overwritten by `options.ratio`. Height of the canvas should be `'auto'` and 
not fixed by CSS. If the height is fixed, the ratio can't be used, and the canvas will use its natural CSS 
size. The dimensions of the images are taken from the image itself after load, and they do not need to be 
set anywhere in the settings.

If the canvas and images have the same ratio, the full image will be displayed. If the ratios are the same, 
but sizes are different, the image will be scaled to fit the canvas. On the page the canvas with the image will
be scaled to canvas CSS size.

If canvas and image ratios are different, then image will use `options.fillMode`, which works like 
background-size `cover` and `contain`, and the image will be centered.

To display the full image, check the image width and height, and set it as canvas inline `width` and `height` 
(or set `options.ratio`).
Then set canvas width by CSS (width="500px" or width="100%" or max-width="800px" etc), and don't set 
canvas height. 

For example, &lt;canvas width="800" height="400"&gt;, image 1200x600, canvas has css max-width="500px". 
Image will be scaled to 800x400 inside canvas and fully visible, canvas on the page will be displayed 
500px x 250px.

After page resize, the sizes will be recalculated automatically, but if canvas was resized by a script, call 
`instance.updateCanvas()`

### Loading errors
All images that have been loaded with errors will be removed from the array of frames. Duration 
of the animation will be recalculated.  

New frames count could be obtained in preload callback:
```javascript
new AnimateImages(element, {
    ...
    onPreloadFinished: function (instance){
        if ( instance.isLoadedWithErrors() ) {
            let newFramesCount = instance.getTotalImages();
        }
    },
});
```

## <a name="options"></a>Options

```javascript
new AnimateImages(element, options);
```
element : HTMLCanvasElement - canvas DOM element (required) 

options:

| Parameter | Type | Default | Description |
| :--- | :---: | :---:| :---  |
| **images** | Array&lt;string&gt; | | **(Required)** Array with images URLs |
| **preload** | string | 'all' | Preload mode ("`all`", "`none`", "`partial`") |
| **preloadNumber** | number | 0 | Number of images to preload when `preload: "partial"` (0 for all images) |
| **poster** | string | | URL of the poster image, works like poster in ```<video>``` |
| **fps** | number | 30 | FPS when playing. Determines the duration of the animation (e.g. 90 images and 60 fps = 1.5s, 90 images and 30fps = 3s) |
| **loop** | boolean | false | Loop the animation | 
| **autoplay** | boolean | false | Autoplay |
| **reverse** | boolean | false | Reverse direction |
| **ratio** | number | false | Canvas width/height ratio, it has higher priority than inline canvas width and height |
| **fillMode** | string | 'cover' | Fill mode to use if canvas and image aspect ratios are different ("`cover`" or "`contain`") |
| **draggable** | boolean | false | Draggable by mouse or touch |
| **inversion** | boolean | false | Inversion changes drag direction |
| **dragModifier** | number | 1 | Sensitivity factor for user interaction. Only positive numbers are allowed |
| **touchScrollMode** | string | "pageScrollTimer" | Page scroll behavior with touch events _(only for events that fire in the plugin area)_. Available modes: `preventPageScroll` - touch scroll is always disabled. `allowPageScroll` - touch scroll is always enabled. `pageScrollTimer` - after the first interaction the scroll is not disabled; if the time between the end of the previous interaction and the start of a new one is less than _pageScrollTimerDelay_, then scroll will be disabled; if more time has passed, then scroll will be enabled again |
| **pageScrollTimerDelay** | number | 1500 | Time in ms when touch scroll will be disabled after the last user interaction, if `touchScrollMode: "pageScrollTimer"` |
| **onPreloadFinished** | function(AnimateImages) | | Callback, occurs when all image files have been loaded, receives plugin instance as a parameter |
| **onPosterLoaded** | function(AnimateImages) | | Callback, occurs when poster image is fully loaded, receives plugin instance as a parameter |
| **onAnimationEnd** | function(AnimateImages) | |  Callback, occurs when animation has ended, receives plugin instance as a parameter |
| **onBeforeFrame** | function(AnimateImages, {context, width, height}) | | Callback, occurs before new frame, receives plugin and canvas info as parameters. Can be used to change settings, for example ```imageSmoothingEnabled``` |
| **onAfterFrame** | function(AnimateImages, {context, width, height}) | | Callback, occurs after the frame was drawn, receives plugin and canvas info as parameters. Can be used to change the image. |

##### Callback example:
```javascript
 let instance1 = new AnimateImages(element, {
    images: imagesArray,
    ...
    onBeforeFrame(plugin, {context, width, height}){
        context.imageSmoothingEnabled = false;
    },
    onAfterFrame(plugin, {context, width, height}){
        context.fillStyle = "green";
        context.fillRect(10, 10, 100, 100);
    },
 });
```
> ```width``` and  ```height``` are internal canvas dimensions, they 
> depend on ```devicePixelRatio```

## <a name="methods"></a>Methods
>  Most methods can be chained (```instance.setReverse(true).play()```)

### play
Start animation

`returns` {AnimateImages} - plugin instance

---

### stop
Stop animation

`returns` {AnimateImages} - plugin instance

---

### toggle
Toggle between start and stop

`returns` {AnimateImages} - plugin instance

---

### next
Show next frame

`returns` {AnimateImages} - plugin instance

---

### prev
Show previous frame

`returns` {AnimateImages} - plugin instance

---

### setFrame
Show a frame with a specified number

`parameters`
- frameNumber {number} - Number of the frame to show
```javascript
instance.setFrame(35);
```
`returns` {AnimateImages} - plugin instance

---

### playTo
Start animation, that plays until the specified frame number

`parameters`
- frameNumber {number} - Target frame number
```javascript
// if current frame is 30 of 100, it will play from 30 to 85, 
// if current frame is 95, it will play from 95 to 85
instance.playTo(85);
```
`returns` {AnimateImages} - plugin instance

---

### playFrames
Start animation in the current direction with the specified number of frames in the queue.
If `loop: false` animation will stop when it reaches the first or the last frame.

`parameters`
- numberOfFrames {number} - Number of frames to play
```javascript
instance.playFrames(200);
```
`returns` {AnimateImages} - plugin instance

---

### setReverse
Change the direction of the animation. Alias to ```setOption('reverse', true)```

`parameters`
- reverse {boolean} - true for backward animation, false for forward
```javascript
instance.setReverse(true);
```
`returns` {AnimateImages} - plugin instance

---


### getReverse
Get current reverse option. Alias to ```getOption('reverse')```

`returns` {boolean} - reverse or not

---

### preloadImages
Start preload specified number of images, can be called multiple times. 
If all the images are already loaded, then nothing will happen

`parameters`
- number {number} - Number of images to load. If not specified, all remaining images will be loaded.
```javascript
instance.preloadImages(15);
```
`returns` {AnimateImages} - plugin instance

---

### updateCanvas
Calculate new canvas dimensions. Should be called after the canvas size was changed in 
the browser

`returns` {AnimateImages} - plugin instance

---

### getOption
Returns option value

`parameters`
- option {string} - Option name. All options are allowed
```javascript
let reverse = instance.getOption('reverse');
```
`returns` {*} - current option value

---

### setOption
Set new option value

`parameters`
- option {string} -  Option name. Allowed options: `fps`, `loop`, `reverse`, `inversion`, `ratio`, `fillMode`, 
  `draggable`, `dragModifier`, `touchScrollMode`, `pageScrollTimerDelay`, `onPreloadFinished`, `onPosterLoaded`, `onAnimationEnd`, 
  `onBeforeFrame`, `onAfterFrame`
- value {*} -  New value

`returns` {AnimateImages} - plugin instance
```javascript
instance.setOption('fps', 40);
instance.setOption('ratio', 2.56);
```

---

### getCurrentFrame
Returns the current frame number. Frames start from 1

`returns` {number} - Frame number

---

### getTotalImages
Returns the total images count (considering loading errors)

`returns` {number}

---

### getRatio
Returns the current canvas ratio. It may differ from the 
value in the `options.ratio`

`returns` {number}

---

### isAnimating
Returns true if the animation is running, and false if not

`returns` {boolean}

---

### isPreloadFinished
Returns true if all the images are loaded and plugin is ready to 
change frames

`returns` {boolean}

---

### isLoadedWithErrors
Returns true if at least one image wasn't loaded because of error

`returns` {boolean}

---

### reset
Stop the animation and return to the first frame

`returns` {AnimateImages} - plugin instance

---

### destroy
Stop animation, remove event listeners and clear the canvas. 
Method doesn't remove canvas element from the DOM

---


## <a name="events"></a>Events
Plugin fires all the events on the canvas element.

**animate-images:loading-progress** - 
Fires after every image load. Progress amount is in `event.detail.progress`

**animate-images:loading-error** - 
Fires after every image.onerror

**animate-images:preload-finished** -
Fires when all the images have been loaded, and the plugin is ready to play

**animate-images:poster-loaded** -
Fires when poster has been loaded

**animate-images:animation-end** -
Fires after the animation end. If the second animation was started 
while the first was active, this event will be fired only after the 
second animation end.

**animate-images:drag-start** -
Fires when user starts dragging. Frame number is in `event.detail.frame`

**animate-images:drag-change** -
Fires on every frame change while dragging. Frame number is in `event.detail.frame`

**animate-images:drag-end** -
Fires when user stops dragging. Frame number is in `event.detail.frame`

Example:
```javascript
let element = document.querySelector('canvas.canvas_el');
let instance = new AnimateImages(element, options);
element.addEventListener('animate-images:loading-progress', function (e){
    console.log(Math.floor(e.detail.progress * 100) + '%');
});
```

## <a name="browser_support"></a>Browser support

* latest versions of Chrome, android Chrome, Edge, Firefox
* Safari 13.1+,
* iOS Safari 13.4+

## <a name="license"></a>License
AnimateImages is provided under the [MIT License](https://opensource.org/licenses/MIT)


  
