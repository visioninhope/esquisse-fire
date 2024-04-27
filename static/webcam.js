const INTERVAL = 30000;

let webcamStreams = new Map();
let webcamInterval = null;
let globalCanvas = null;
let ctx = null;

import { handleDroppedImage } from "./input-change.js"

export { startWebcam, stopWebcam, captureAndHandle };

function initializeCanvas() {
    if (!globalCanvas) {
        globalCanvas = document.createElement('canvas');
        ctx = globalCanvas.getContext('2d');
    }
}

async function startWebcam(groupElement) {
    initializeCanvas();

    const feed = groupElement.querySelector('.webcam-feed');
    const videoZone = groupElement.querySelector(".video-zone");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });

        feed.srcObject = stream;
        videoZone.style.display = 'block';
        feed.dataset.active = 'true';  // Mark as active
        webcamStreams.set(groupElement, stream);

        feed.oncanplay = () => {
            if (feed.readyState >= 2) {
                captureAndHandle(groupElement); // Capture immediately)
            }
            if (!webcamInterval) {
                startCapture();
            }
        };
    } catch (error) {
        console.error('Error starting webcam:', error);
    }
}

function stopWebcam(groupElement) {
    const feed = groupElement.querySelector('.webcam-feed');
    const videoZone = groupElement.querySelector(".video-zone");

    const stream = webcamStreams.get(groupElement);
    if (stream) {
        // Stop all tracks on this group's webcam stream
        stream.getTracks().forEach(track => track.stop());
        // Remove stream from the map
        webcamStreams.delete(groupElement);
    }
    videoZone.style.display = 'none';
    feed.srcObject = null;
    feed.removeAttribute('data-active');

    // Check if any active webcams are left
    if (webcamStreams.size === 0 && webcamInterval) {
        clearInterval(webcamInterval);
        webcamInterval = null;
    }
}

function startCapture() {
    if (!webcamInterval) {
        webcamInterval = setInterval(() => {
            document.querySelectorAll('.group:has(.webcam-feed[data-active="true"])').forEach(groupElement => {
                captureAndHandle(groupElement);
            });
        }, INTERVAL);
    }
}


async function captureAndHandle(groupElement) {

    const feed = groupElement.querySelector('.webcam-feed');

    if (feed.readyState >= 2) {
        const blob = await captureImageFromWebcam(feed);
        handleDroppedImage(blob, groupElement);
    }
}

async function captureImageFromWebcam(feed) {
    const width = feed.videoWidth;
    const height = feed.videoHeight;

    globalCanvas.width = width;
    globalCanvas.height = height;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    ctx.drawImage(feed, 0, 0, width, height);
    ctx.restore();

    return new Promise(resolve => globalCanvas.toBlob(resolve, 'image/jpeg'));
}

