import { Sortable, MultiDrag } from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/+esm';
import { rebuildGroupsInNewOrder } from './group-management.js';

export { onDragStart, onDragEnd, addMiniviewButtonsListeners, applyScale };

// mobile agent detection
const userAgent = navigator.userAgent || navigator.vendor || window.opera;
const isAndroid = /android/i.test(userAgent);
const isIPhone = /iphone/i.test(userAgent) || /ipod/i.test(userAgent);
const isIPad = /ipad/i.test(userAgent);

// We want to be able to treat entering teh miniview with drag or via button differently
let MINI_VIEW_BY_BUTTON = false;

Sortable.mount(new MultiDrag());

Sortable.create(document.querySelector('.container'), {
    handle: '.drag-handle', // Restricts drag start to this element
    animation: 150,
    draggable: ".group",
    multiDrag: true,
    onStart: onStartSortable,
    onEnd: onEndSortable,
    // fix multidrag on mobile https://github.com/SortableJS/Sortable/issues/1733#issuecomment-1560720653
    supportPointer: isAndroid || isIPhone || isIPad,
    fallbackTolerance: 5,
});

window.addEventListener('resize', () => {

    applyScale();

});

function onStartSortable(event) {

    const zoomableElement = document.querySelector(".zoomable");

    const sortstarted = new CustomEvent("sortstart", {
        detail: "",
        bubbles: true,
        cancelable: true
    });

    zoomableElement.dispatchEvent(sortstarted);

    if (!zoomableElement.classList.contains("miniview")) onEnteringMiniview();
}

function onEnteringMiniview() {

    applyScale();

    const scroll_y = window.scrollY;

    const zoomableElement = document.querySelector(".zoomable");

    const classChangeCallback = (mutationList, observer) => {
        mutationList.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {

                if (!zoomableElement.classList.contains("miniview")) {
                    console.log("Scrolling back to ", scroll_y);
                    window.scroll({
                        top: scroll_y
                    });

                    observer.disconnect();
                }
            }
        });
    };

    const observerOptions = {
        attributes: true,
        attributeFilter: ['class'],
    };

    const observer = new MutationObserver(classChangeCallback);
    observer.observe(zoomableElement, observerOptions);

    zoomableElement.classList.add("miniview");
}

function applyScale() {
    const windowHeight = window.innerHeight;

    const groupsContainer = document.querySelector(".container");
    const containerElementFullHeight = groupsContainer.scrollHeight;

    console.log("[miniview] containerElementFullHeight ", containerElementFullHeight)

    const footerTools = document.querySelector(".footer-tools");
    const footerToolsHeight = footerTools.clientHeight;

    const containerElementVisibleContentHeight = windowHeight - footerToolsHeight;

    console.log("[miniview] containerElementVisibleContentHeight ", containerElementVisibleContentHeight)

    const scale = Math.min(1, containerElementVisibleContentHeight / containerElementFullHeight);

    console.log("[miniview] scale ", scale);

    document.documentElement.style.setProperty('--scale', scale);
}

function onDragStart(event) {

    setTimeout(() => {
        event.target.classList.add("grabbing");
    }, 50);
}

function onEndSortable(event) {

    const zoomableElement = document.querySelector(".zoomable");

    const sortended = new CustomEvent("sortend", {
        detail: "",
        bubbles: true,
        cancelable: true
    });

    zoomableElement.dispatchEvent(sortended);

    if (!MINI_VIEW_BY_BUTTON) zoomableElement.classList.remove("miniview");

    event.item.classList.remove("grabbing");

    const groupElements = document.querySelectorAll('.container .group');

    groupElements.forEach(element => {
        Sortable.utils.deselect(element);
    });

    rebuildGroupsInNewOrder();
}


function onDragEnd(event) {
    event.target.classList.remove("grabbing");
}


function addMiniviewButtonsListeners() {

    const zoomableElement = document.querySelector(".zoomable");

    document
        .querySelector(".enter-miniview-btn")
        .addEventListener("click", () => {

            MINI_VIEW_BY_BUTTON = true;

            onEnteringMiniview();

            const enterMiniviewButton = document.querySelector(".enter-miniview-btn");
            enterMiniviewButton.style.display = 'none';

            const exitMiniviewButton = document.querySelector(".exit-miniview-btn");
            exitMiniviewButton.style.display = 'inline-block';

        });


    document
        .querySelector(".exit-miniview-btn")
        .addEventListener("click", () => {

            MINI_VIEW_BY_BUTTON = false;

            zoomableElement.classList.remove("miniview");

            const enterMiniviewButton = document.querySelector(".enter-miniview-btn");
            enterMiniviewButton.style.display = 'inline-block';

            const exitMiniviewButton = document.querySelector(".exit-miniview-btn");
            exitMiniviewButton.style.display = 'none';

        });
}

