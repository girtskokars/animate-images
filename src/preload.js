//============ PRELOAD
export function startLoadingImages(preloadNumber = 0, { settings, data }){
    if (data.load.isPreloadFinished) return;

    // if too many, load just the rest
    let unloadedCount = data.totalImages - data.load.preloadOffset;
    if (preloadNumber > unloadedCount){
        preloadNumber = unloadedCount;
    }

    // true when all the images are in queue but not loaded yet, (unloadedCount = preloadNumber = 0)
    if (preloadNumber <= 0) return;

    //console.log(`start loop, preloadNumber=${preloadNumber}, offset=${data.load.preloadOffset}`);
    for (let i = data.load.preloadOffset; i < (preloadNumber + data.load.preloadOffset); i++){
        let img = new Image();
        img.onload = onImageLoad;
        img.onerror = onImageLoad;
        img.src = settings.images[i];
        data.loadedImagesArray[i] = img;
    }
    data.load.preloadOffset = data.load.preloadOffset + preloadNumber;

    function onImageLoad(e){
        data.load.preloadedImagesNumber++;
        let progress = Math.floor((data.load.preloadedImagesNumber/data.totalImages) * 1000) / 1000 ;
        data.canvas.element.dispatchEvent( new CustomEvent('animate-images:loading-progress', {detail: {progress}}) );
        if (e.type === "error") {
            data.load.isLoadWithErrors = true;
            data.canvas.element.dispatchEvent( new Event('animate-images:loading-error') );
        }
        if (data.load.preloadedImagesNumber === data.totalImages) {
            data.load.isPreloadFinished = true;
            data.load.onLoadFinishedCB();
        }
    }
}
