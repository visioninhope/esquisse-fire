
import Graph from "https://cdn.jsdelivr.net/npm/graph-data-structure@3.3.0/+esm";

import { showDataFlow, removeDataFlow } from "./dataflowvisualization.js";

// drag and drop reordering 

import { Sortable, MultiDrag } from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/+esm';

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

function onStartSortable(event) {

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

    groupsContainer.classList.add("miniview");
}

function onDragStart(event) {

    setTimeout(() => {
        event.target.classList.add("grabbing");
    }, 50);
}

function onEndSortable(event) {

    const groupsContainer = document.querySelector(".container");

    if (!MINI_VIEW_BY_BUTTON) groupsContainer.classList.remove("miniview");

    event.item.classList.remove("grabbing");

    removeDataFlow();
    if (SETTINGS.dataFlowEnabled) {
        showDataFlow(IS_USED_BY_GRAPH);
    }

    // Intermediary Map to store the reordered groups
    const newGroups = new Map();

    const groupElements = document.querySelectorAll('.container .group');

    groupElements.forEach(element => {

        Sortable.utils.deselect(element);

        const id = element.getAttribute('data-id');

        // Retrieve the group object from GROUPS
        // to set it into the newGroups map
        newGroups.set(id, GROUPS.get(id));
    });

    GROUPS = newGroups;

    document.title = `${GROUPS.values().next().value.name} · Esquisse AI`

    persistGroups();
}

function onDragEnd(event) {
    event.target.classList.remove("grabbing");
}

// END drag and drop reordering

// edge means ' is used by -> '
// this is a reverse reference graph
// pointing to groups depending on a given group
let IS_USED_BY_GRAPH = Graph();

let GROUPS = new Map();

const DELAY = 5000;

const REFERENCE_MATCHING_REGEX = /#([\w-.]+)|(?:\[)([^\]]+)(?:\])/g;

let REQUEST_QUEUE = {};

let HAS_HASH_CHANGED_PROGRAMMATICALLY = false;

const INTERACTION_STATE = {
    OPEN: "open",
    ENTRY: "entry",
    LOCKED: "locked",
};

const GROUP_TYPE = {
    STATIC: "static",
    TEXT: "text",
    IMAGE: "image",
    BREAK: "break",
    GRID: "grid",
    IMPORT: "import",
};

const SETTINGS = {

    qualityEnabled: false,
    dataFlowEnabled: false,

}

// Call the init function when the page loads

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

function init() {
    loadGroups();

    window.addEventListener("hashchange", () => {
        console.log("Hash changed! Programmatically? ", HAS_HASH_CHANGED_PROGRAMMATICALLY);
        if (!HAS_HASH_CHANGED_PROGRAMMATICALLY) {
            loadGroups();
        }
        HAS_HASH_CHANGED_PROGRAMMATICALLY = false;
    });

    const groupsContainer = document.querySelector(".container");

    document
        .querySelector(".enter-miniview-btn")
        .addEventListener("click", () => {

            MINI_VIEW_BY_BUTTON = true;

            onStartSortable();

            const enterMiniviewButton = document.querySelector(".enter-miniview-btn");
            enterMiniviewButton.style.display = 'none';

            const exitMiniviewButton = document.querySelector(".exit-miniview-btn");
            exitMiniviewButton.style.display = 'inline-block';

        });


    document
        .querySelector(".exit-miniview-btn")
        .addEventListener("click", () => {

            MINI_VIEW_BY_BUTTON = false;

            groupsContainer.classList.remove("miniview");

            const enterMiniviewButton = document.querySelector(".enter-miniview-btn");
            enterMiniviewButton.style.display = 'inline-block';

            const exitMiniviewButton = document.querySelector(".exit-miniview-btn");
            exitMiniviewButton.style.display = 'none';

        });


    const transitionstartHandler = (event) => {
        removeDataFlow();
    }

    const transitionendHandler = (event) => {
        removeDataFlow();
        if (SETTINGS.dataFlowEnabled) {
            showDataFlow(IS_USED_BY_GRAPH);
        }
    }

    groupsContainer.addEventListener("transitionstart", transitionstartHandler)
    groupsContainer.addEventListener("transitionend", transitionendHandler)

    document
        .querySelector(".add-break-group-btn")
        .addEventListener("click", () => createGroupAndAddGroupElement(GROUP_TYPE.BREAK));

    document
        .querySelector(".add-static-group-btn")
        .addEventListener("click", () => createGroupAndAddGroupElement(GROUP_TYPE.STATIC));

    document.querySelector(".add-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.TEXT)
    );

    document.querySelector(".add-img-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.IMAGE)
    );

    // Settings Menu Listeners

    const settingsMenu = document.querySelector('.settings-menu');

    const openButton = document.querySelector('.open-settings-menu-btn');
    const closeButton = settingsMenu.querySelector('.close-settings-menu-btn');

    openButton.addEventListener('click', () => settingsMenu.show());
    closeButton.addEventListener('click', () => settingsMenu.hide());

    const qualitySwitch = settingsMenu.querySelector('.quality-switch');

    qualitySwitch.addEventListener('sl-change', event => {
        console.log(event.target.checked ? 'qualitySwitch checked' : 'qualitySwitch un-checked');
        SETTINGS.qualityEnabled = event.target.checked;
    });

    const dataflowSwitch = settingsMenu.querySelector('.dataflow-switch');

    dataflowSwitch.addEventListener('sl-change', event => {
        console.log(event.target.checked ? 'dataflow-switch checked' : 'dataflow-switch un-checked');

        if (event.target.checked) {
            SETTINGS.dataFlowEnabled = true;
            showDataFlow(IS_USED_BY_GRAPH);
        }
        else {
            SETTINGS.dataFlowEnabled = false;
            removeDataFlow();
        }

    });
}


function persistGroups() {
    const strippedGroups = Array.from(GROUPS.values()).map(({ name, data, transform, type, interactionState }) => ({
        name,
        data,
        transform,
        type,
        interactionState,
    }));

    console.log("Persisting in URL", strippedGroups);
    try {
        const base64Groups = btoa(JSON.stringify(strippedGroups));
        HAS_HASH_CHANGED_PROGRAMMATICALLY = true;
        window.location.hash = base64Groups;
    } catch (error) {
        console.log("Base64 failed, impossible to persist in URL")
        return;
    }
}

function loadGroups() {
    const base64Groups = window.location.hash.slice(1);

    if (!base64Groups) {
        createGroupAndAddGroupElement();
        return;
    }

    try {
        const strippedGroups = JSON.parse(atob(base64Groups));

        console.log("loading groups from hash", strippedGroups);

        GROUPS.clear();

        const groupsContainer = document.querySelector(".container");
        groupsContainer.innerHTML = "";

        strippedGroups.forEach(({ name, data, transform, type, interactionState }) => {
            const group = {
                id: generateUniqueGroupID(),
                name,
                data,
                transform,
                type: type || GROUP_TYPE.TEXT,
                result: null,
                lastRequestTime: 0,
                interactionState: interactionState || INTERACTION_STATE.OPEN,
            };

            GROUPS.set(group.id, group);

            const groupElement = addGroupElement(group.type, group.id);

            const groupNameElement = groupElement.querySelector(".group-name");
            const dataElement = groupElement.querySelector(".data-text");
            const transformElement = groupElement.querySelector(".transform-text");

            // Break groups elements don't have name and data elements
            if (groupNameElement) groupNameElement.value = group.name;
            if (dataElement) dataElement.value = group.data;

            if (type === GROUP_TYPE.STATIC) {
                // If data is present, call handleInput to combine data and references into a referenceable result
                if (dataElement.value) {
                    handleInputChange(groupElement, true, false);
                }
            }

            if (group.type === GROUP_TYPE.TEXT || group.type === GROUP_TYPE.IMAGE) {

                transformElement.value = transform;

                // If data is present and transform value is present, call handleInput to try to send an immediate API request
                if (dataElement.value && transformElement.value) {
                    handleInputChange(groupElement, true, false);
                }
            }

            // setGroupInteractionState set the right UI state, 
            // using optional chaining to ignore absent inputs
            setGroupInteractionState(groupElement, group.interactionState);

        });
    } catch (error) {
        console.error("Error loading groups", error);
    }

    console.log("groups loaded: ", GROUPS);

    document.title = `${GROUPS.values().next().value.name} · Esquisse AI`

    IS_USED_BY_GRAPH = buildReverseReferenceGraph();

    // update all nodes, in topological order
    // this will fail if a cycle is detected
    updateGroups(IS_USED_BY_GRAPH.nodes(), true);
}

function addGroupElement(groupType = GROUP_TYPE.TEXT, groupId) {
    const groupElement = document.createElement("div");

    groupElement.dataset.id = groupId;

    switch (groupType) {

        case GROUP_TYPE.BREAK:
            groupElement.className = "group break";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small>➗</small>
                    <div class="drag-handle">···</div>
                    <button class="tool-btn delete-btn">&#x2715;</button>
                </div>
                <input type="text" class="group-name" placeholder="Name of this block">
            `;
            break;

        case GROUP_TYPE.STATIC:
            groupElement.className = "group static";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small>💠</small>
                    <div class="drag-handle">···</div>
                    <button class="tool-btn delete-btn">&#x2715;</button>
                </div>
                <input type="text" class="group-name" placeholder="Name of this block">
                <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
                <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
                <div class="function-buttons-container">
                <button class="tool-btn entry-btn">📥</button>
                <button class="tool-btn lock-btn">🔒</button>
                </div>
            `;
            break;

        case GROUP_TYPE.IMAGE:
            groupElement.className = "group image";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small>🎨</small>
                    <div class="drag-handle">···</div>
                    <button class="tool-btn delete-btn">&#x2715;</button>
                </div>
                <input type="text" class="group-name" placeholder="Name of this Block">
                <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
                <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
                <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>
                <div class="function-buttons-container">
                    <button class="tool-btn entry-btn">📥</button>
                    <button class="tool-btn lock-btn">🔒</button>
                    <button class="tool-btn refresh-btn">🔄</button>
                </div>
                <img class="result">
                <a class="download-btn">⬇️</a>
            `;
            break;

        default:
            groupElement.className = "group text";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small>📝</small>
                    <div class="drag-handle">···</div>
                    <button class="tool-btn delete-btn">&#x2715</button>
                </div>
                <input type="text" class="group-name" placeholder="Name of this block">
                <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
                <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
                <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>
                <div class="function-buttons-container">
                <button class="tool-btn entry-btn">📥</button>
                <button class="tool-btn lock-btn">🔒</button>
                <button class="tool-btn refresh-btn">🔄</button>
                </div>
            `;
    }

    // Initially hide the referenced-result-text 
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    if (refResultTextarea) {
        refResultTextarea.style.display = 'none';
    }
    // Initially hide the result 
    const resultElement = groupElement.querySelector(".result");
    if (resultElement) {
        resultElement.style.display = 'none';
    }

    // Initially hide the refresh button
    const refreshButton = groupElement.querySelector(".refresh-btn");
    if (refreshButton) {
        refreshButton.style.display = 'none';
    }
    // Initially hide the download button
    const downloadButton = groupElement.querySelector(".download-btn");
    if (downloadButton) {
        downloadButton.style.display = 'none';
    }

    const container = document.querySelector(".container");
    container.appendChild(groupElement);

    addEventListenersToGroup(groupElement);

    groupElement.scrollIntoView(true, { behavior: "auto", block: "end" });

    const animationendHAndler = () => {
        groupElement.classList.remove('new-group-appearing');
        groupElement.removeEventListener('animationend', animationendHAndler);
    }

    groupElement.addEventListener(
        'animationend',
        animationendHAndler
    );

    groupElement.classList.add('new-group-appearing');

    return groupElement;
}

function createGroupAndAddGroupElement(groupType = GROUP_TYPE.TEXT) {

    const id = generateUniqueGroupID();

    const group = {
        id,
        name: groupType + "-" + id,
        data: "",
        transform: "",
        type: groupType,
        result: null,
        lastRequestTime: 0,
        interactionState: INTERACTION_STATE.OPEN,
    };

    console.log("New group:", group)

    GROUPS.set(group.id, group);

    // we are interested in having even the isolated groups in the graph
    // as we will use them in the updateGroups function
    // except for the break groups
    if (!GROUP_TYPE.BREAK) IS_USED_BY_GRAPH.addNode(group.id);

    persistGroups();

    const groupElement = addGroupElement(groupType, group.id);

    const groupNameElement = groupElement.querySelector(".group-name");

    groupNameElement.value = group.name;

    return groupElement;
}

function addEventListenersToGroup(groupElement) {
    const groupNameElement = groupElement.querySelector(".group-name");
    const dataElement = groupElement.querySelector(".data-text");
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    const transformElement = groupElement.querySelector(".transform-text");

    const group = getGroupFromElement(groupElement);

    console.log("got group:", group)
    console.log("adding listener to group :", group.name)

    // Handle drag events to fix custom cursors with SortableJS 
    // https://github.com/SortableJS/Vue.Draggable/issues/815#issuecomment-1552904628
    // these drag events won't be fired on iOS, so we use them only for the cursor fix

    groupElement.addEventListener("dragstart", onDragStart);
    groupElement.addEventListener("dragend", onDragEnd);

    // Persist and handle change when a group's name, data or transform changes

    groupNameElement?.addEventListener("change", () => {

        group.name = groupNameElement.value.trim();

        // if this is the first group, rename the page using its new name
        if (group.id === GROUPS.keys().next().value) {
            document.title = `${group.name} · Esquisse AI`;
        }

        console.log(`Group ${groupNameElement} name now:${group.name}`)
        persistGroups();
    });

    dataElement?.addEventListener('change',
        () => {

            handleInputChange(groupElement, true, false);

        });


    transformElement?.addEventListener("change", () => {
        handleInputChange(groupElement, true, false);
    });


    dataElement?.addEventListener("blur", () => {
        const { hasReferences, referencedResults, combinedReferencedResults } = getReferencedResultsAndCombinedDataWithResults(dataElement.value, group.name);
        if (referencedResults.length > 0) {
            group.combinedReferencedResults = combinedReferencedResults;
            displayCombinedReferencedResult(groupElement, combinedReferencedResults);
        }
    });

    refResultTextarea?.addEventListener("focus", () => {
        refResultTextarea.style.display = "none";
        dataElement.style.display = "block";
        dataElement.focus();
    });

    dataElement?.addEventListener("focus", () => {
        refResultTextarea.style.display = "none";
    });



    /******** Tool buttons *************/
    groupElement.querySelector(".delete-btn").addEventListener("click", () => deleteGroup(groupElement));


    groupElement.querySelector(".lock-btn")?.addEventListener("click", () => {
        group.interactionState = group.interactionState === INTERACTION_STATE.LOCKED ? INTERACTION_STATE.OPEN : INTERACTION_STATE.LOCKED;
        setGroupInteractionState(groupElement, group.interactionState);
        persistGroups();
    });

    groupElement.querySelector(".entry-btn")?.addEventListener("click", () => {
        group.interactionState = group.interactionState === INTERACTION_STATE.ENTRY ? INTERACTION_STATE.OPEN : INTERACTION_STATE.ENTRY;
        setGroupInteractionState(groupElement, group.interactionState);
        persistGroups();
    });


    groupElement.querySelector(".refresh-btn")?.addEventListener("click", () => handleInputChange(groupElement, true, true));


}

function deleteGroup(groupElement) {
    const id = getGroupIdFromElement(groupElement);

    groupElement.remove();

    GROUPS.delete(id);

    // the actual group data is now gone, 
    // so references to the group will be treated as wrong

    updateGroupsReferencingIt(id);

    // as updateGroupsReferencingIt() uses the graph to find the groups to update
    // we can only call removeNode() on the graph once all groups have been alerted.

    IS_USED_BY_GRAPH.removeNode(id)

    persistGroups();
}

function setGroupInteractionState(groupElement, interactionState) {
    const groupNameElement = groupElement.querySelector(".group-name");
    const dataElement = groupElement.querySelector(".data-text");
    const transformElement = groupElement.querySelector(".transform-text");

    switch (interactionState) {
        case INTERACTION_STATE.OPEN:
            groupNameElement?.removeAttribute("readonly");
            dataElement?.removeAttribute("readonly");
            transformElement?.removeAttribute("readonly");
            break;
        case INTERACTION_STATE.ENTRY:
            groupNameElement?.setAttribute("readonly", "readonly");
            dataElement?.removeAttribute("readonly");
            transformElement?.setAttribute("readonly", "readonly");
            break;
        case INTERACTION_STATE.LOCKED:
            groupNameElement?.setAttribute("readonly", "readonly");
            dataElement?.setAttribute("readonly", "readonly");
            transformElement?.setAttribute("readonly", "readonly");
            break;
    }
}

async function handleInputChange(groupElement, immediate = false, isRefresh = false, isUserActivatedUpdate = true) {

    const group = getGroupFromElement(groupElement);

    if (group.type === GROUP_TYPE.BREAK) return;

    const dataElement = groupElement.querySelector(".data-text");
    const transformElement = groupElement.querySelector(".transform-text");
    const data = dataElement.value;
    const transform = transformElement?.value || "";

    let currentData = data;
    let referencedResultsChanged = false;

    const { hasReferences, referencedResults, combinedReferencedResults } = getReferencedResultsAndCombinedDataWithResults(data, group.name);

    // if there's references, display them and use the combination of all references as currentData
    if (referencedResults.length > 0) {
        displayCombinedReferencedResult(groupElement, combinedReferencedResults);

        // check if the new combined results from references is different from the previous combination
        currentData = combinedReferencedResults;
        referencedResultsChanged = currentData !== group.combinedReferencedResults;
        group.combinedReferencedResults = currentData;
    }

    // we do nothing more if no change and not an explicit refresh request
    if (!isRefresh
        && group.data === data
        && group.transform === transform
        && !referencedResultsChanged
    ) {
        console.log("No value changed, aborting input change");
        return;
    }

    if (group.type === GROUP_TYPE.STATIC) {
        console.log(`[COMBINING] statict text ||| ${currentData}`);

        group.result = combinedReferencedResults;

        let resultParagraph = groupElement.querySelector(".result");

        if (!resultParagraph) {
            resultParagraph = document.createElement("p");
            resultParagraph.className = "result";
            groupElement.appendChild(resultParagraph);
        }

        resultParagraph.textContent = group.result;

        if (isUserActivatedUpdate) updateGroupsReferencingIt(group.id);
    }

    group.data = data;
    group.transform = transform;
    persistGroups();

    const lastTransformValue = transform;
    const dataReadyToSend = !hasReferences && currentData || referencedResults.length > 0;

    if (dataReadyToSend && lastTransformValue) {
        clearTimeout(REQUEST_QUEUE[group.name]);

        const currentTime = Date.now();

        if (currentTime - group.lastRequestTime < DELAY && !immediate) {
            const timeout = DELAY - (currentTime - group.lastRequestTime);
            console.log(`Waiting for ${timeout / 1000} seconds`);
            if (REQUEST_QUEUE[group.name]) {
                clearTimeout(REQUEST_QUEUE[group.name]);
            }
            REQUEST_QUEUE[group.name] = setTimeout(() => {
                handleInputChange(groupElement, true, isRefresh);
            }, timeout);
            return;
        }

        group.lastRequestTime = currentTime;

        const fetchOptions = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: currentData,
                transform: lastTransformValue,
                qualityEnabled: SETTINGS.qualityEnabled,
            }),
        };

        if (group.type === GROUP_TYPE.IMAGE) {

            console.log(`[REQUEST] image ||| ${currentData} ||| ${lastTransformValue}`);

            groupElement.classList.remove("error");
            groupElement.classList.add("waiting");
            const fetchingIndicatorElement = document.querySelector(".fetching-indicator");
            fetchingIndicatorElement.classList.add("waiting");

            try {
                const response = await fetch("/stability", fetchOptions);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const resultBuffer = await response.arrayBuffer();

                console.log(`Received image result buffer`);

                const blob = new Blob([resultBuffer]);
                group.result = blob;

                const reader = new FileReader();

                return new Promise((resolve, reject) => {
                    reader.onloadend = async function () {
                        const base64data = reader.result;
                        let resultImage = groupElement.querySelector(".result");
                        if (!resultImage) {
                            resultImage = document.createElement("img");
                            resultImage.className = "result";
                            groupElement.appendChild(resultImage);
                        }
                        resultImage.style.display = "block";
                        resultImage.src = base64data;

                        groupElement.querySelector(".refresh-btn").style.display = "block";

                        const downloadButton = groupElement.querySelector(".download-btn");

                        downloadButton.style.display = "block";
                        downloadButton.href = base64data;
                        downloadButton.download = group.name + "" + randomInt(1, 99999) + ".png";

                        delete REQUEST_QUEUE[group.name];
                        resolve(base64data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);

                    groupElement.classList.remove("waiting")
                    removeGlobalWaitingIndicator();

                });
            } catch (error) {
                groupElement.classList.remove("waiting")
                removeGlobalWaitingIndicator();
                groupElement.classList.add("error")
                console.error(`Fetch failed: ${error}`);
            }
        } else if (group.type === GROUP_TYPE.TEXT) {
            console.log(`[REQUEST] text ||| ${currentData} ||| ${lastTransformValue}`);

            groupElement.classList.remove("error");
            groupElement.classList.add("waiting");
            const fetchingIndicatorElement = document.querySelector(".fetching-indicator");
            fetchingIndicatorElement.classList.add("waiting");

            try {
                const response = await fetch("/chatgpt", fetchOptions);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                console.log(`Received result: ${result}`);

                group.result = result;
                let resultParagraph = groupElement.querySelector(".result");
                if (!resultParagraph) {
                    resultParagraph = document.createElement("p");
                    resultParagraph.className = "result";
                    groupElement.appendChild(resultParagraph);
                }
                resultParagraph.textContent = group.result;
                groupElement.querySelector(".refresh-btn").style.display = "block";

                if (isUserActivatedUpdate) updateGroupsReferencingIt(group.id);


                delete REQUEST_QUEUE[group.name];
                groupElement.classList.remove("waiting");
                removeGlobalWaitingIndicator();

            } catch (error) {
                groupElement.classList.remove("waiting");
                removeGlobalWaitingIndicator();
                groupElement.classList.add("error");
                console.error(`Fetch failed: ${error}`);
            }
        }
    }
}

function removeGlobalWaitingIndicator() {

    const waitingGroups = document.querySelector(".group.waiting");

    if (!waitingGroups) {
        const fetchingIndicatorElement = document.querySelector(".fetching-indicator");

        fetchingIndicatorElement.classList.remove("waiting");
    }
}

function getReferencedGroupNamesFromDataText(data) {

    let matches = [];

    const regex = REFERENCE_MATCHING_REGEX;

    for (const match of data.matchAll(regex)) {
        if (match[1]) matches.push(match[1]);
        else if (match[2]) matches.push(match[2]);
    }

    return matches;
}

function replaceThisGroupReferenceWithResult(name, data) {
    // Validate the name to ensure it conforms to the allowed format
    if (!/^[\w\s-.]+$/.test(name)) {
        console.error('Invalid name format');
        return data; // return the original data if the name format is invalid
    }

    // Escape special regex characters in the name
    const escapedName = name.replace(/([.*+?^${}()|\[\]\\])/g, '\\$&');

    // Fetch the group using the given name and check its validity
    const referencedGroup = getGroupFromName(name);
    if (!referencedGroup || referencedGroup.result === undefined) {
        console.error('Invalid group or result');
        return data; // return the original data if the group or result is invalid
    }

    // Create regex patterns for the name with and without spaces
    const targetPatternBracket = new RegExp(`\\[${escapedName}\\]`, 'g');
    const targetPatternHash = /\s/.test(name) ? null : new RegExp(`#${escapedName}(?!\\w)`, 'g');

    let replacedData = data;

    // Replace each match of targetPatternBracket in data
    replacedData = replacedData.replace(targetPatternBracket, () => referencedGroup.result);

    // If the name does not contain spaces, replace each match of targetPatternHash in data
    if (targetPatternHash) {
        replacedData = replacedData.replace(targetPatternHash, () => referencedGroup.result);
    }

    return replacedData;
}


function getGroupIdFromElement(groupElement) {
    return groupElement.dataset.id;
}

function getGroupElementFromName(groupName) {
    console.log("Getting the element for group named", groupName)
    const container = document.querySelector(".container");
    return container.querySelector(`.group-name[value="${groupName}"]`).parentNode;
}

function getGroupElementFromId(groupId) {
    console.log("Getting the element for group of id ", groupId);
    return document.querySelector(`div[data-id="${groupId}"]`);
}


function getGroupFromElement(groupElement) {
    const groupId = getGroupIdFromElement(groupElement);

    console.log("group id found is", groupId)

    return GROUPS.get(groupId);
}

function getGroupFromName(name) {

    // will return the first group found by that name, ignore the rest

    for (const [key, group] of GROUPS) {

        if (group.name === name) {
            return group;
        }
    }
    console.log("couldn't find a group named ", name)
    return undefined
}

function generateUniqueGroupID() {
    let name = "";
    let unique = false;
    while (!unique) {
        name = `${randomInt(1, 9999)}`;
        if (!GROUPS.has(name)) {
            unique = true;
        }
    }
    return name;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}


function buildReverseReferenceGraph() {

    console.log("Building the invert dependency graph from the groups structure")

    // Builds the graph of 'group as a result' =>> groups that reference them to use their result
    //
    // example:
    // group 45 uses 62 and 336's results (45 references 62 and 336 in its dataText)
    // edge will be 
    // 62-> 45, 336-> 45
    //
    // that way 62 can easily find that 45 is using its result, and notify it of changes

    const graph = Graph();

    for (const [key, group] of GROUPS) {

        graph.addNode(group.id);

        const namesOfAllGroupsReferencedByThisGroup = getReferencedGroupNamesFromDataText(group.data);

        for (const referencedGroupName of namesOfAllGroupsReferencedByThisGroup) {

            const referencedGroup = getGroupFromName(referencedGroupName);

            console.log(referencedGroupName, referencedGroup)

            if (referencedGroup) {
                console.log("named reference to existing group, added to invert dependency graph", referencedGroupName, referencedGroup)

                graph.addEdge(referencedGroup.id, group.id)
            }
            else {
                console.log("named reference to unexisting group, not added to invert dependency graph", referencedGroupName)
            }
        }
    }

    console.log(graph.serialize());

    return graph;
}

async function updateGroups(idsOfGroupsToUpdate, forceRefresh = false) {

    // We sort the groups to update them in topological order
    // to avoid re-updating a group that would depends on both this group and another updated group

    // if forceRefresh is true, we will update all groups in order.
    // it useful foe example on loading.

    // select the isolated nodes, to update them without blocking
    let independentUpdates = idsOfGroupsToUpdate.filter(id =>
        IS_USED_BY_GRAPH.indegree(id) === 0
        && IS_USED_BY_GRAPH.outdegree(id) === 0
    );

    // filter out the independent nodes from the dependent updates
    let dependentUpdates = idsOfGroupsToUpdate.filter(id => !independentUpdates.includes(id));

    console.log("[UpdateGroups] Dependent updates Sorted: ", dependentUpdates);

    console.log("[UpdateGroups] Independent Updates", independentUpdates);

    // The sort raise a CycleError if a cycle is found 
    try {
        dependentUpdates = IS_USED_BY_GRAPH.topologicalSort(idsOfGroupsToUpdate)

    } catch (error) {
        console.log("[CycleError] Circular dependency between these groups:", idsOfGroupsToUpdate)
        return;
    }

    for (const id of independentUpdates) {

        console.log("Independent group, updating without awaiting", id)

        handleInputChange(
            getGroupElementFromId(id),
            true,
            forceRefresh,
            false);
    };

    for (const id of dependentUpdates) {

        console.log("Dependent group, awaiting update", id)

        // if we don't await, a further group might launch a request when it actually depends on the previous group results
        // we stop being fully reactive and fully async here
        // and await between each steps
        // we should probably use the graph more to async everything that can

        await handleInputChange(
            getGroupElementFromId(id),
            true,
            forceRefresh,
            false);
    };
}

function updateGroupsReferencingIt(id) {

    // get the list of groups that depends on the changed group in their dataText
    // precomputed in the reverse graph.

    const idsOfGroupsToUpdate = IS_USED_BY_GRAPH.adjacent(id);

    updateGroups(idsOfGroupsToUpdate);

}

function getReferencedResultsAndCombinedDataWithResults(dataText, currentGroupName) {

    const namesOfAllGroupsReferencedByThisGroup = getReferencedGroupNamesFromDataText(dataText);

    let hasReferences = namesOfAllGroupsReferencedByThisGroup && namesOfAllGroupsReferencedByThisGroup.length > 0;

    let referencedResults = [];
    let combinedReferencedResults = dataText;

    if (hasReferences) {
        const currentGroup = getGroupFromName(currentGroupName);
        const validReferencedResults = [];

        for (const name of namesOfAllGroupsReferencedByThisGroup) {
            const referencedGroup = getGroupFromName(name);

            if (!referencedGroup) {
                console.log(`Trying to show reference but no group "${name}" found`);
                continue;
            }

            // The referenced group exists and is used by the current group
            // We update the inverse reference graph
            IS_USED_BY_GRAPH.addEdge(referencedGroup.id, currentGroup.id);

            const hasDirectCircularReference = IS_USED_BY_GRAPH.hasEdge(referencedGroup.id, currentGroup.id) && IS_USED_BY_GRAPH.hasEdge(currentGroup.id, referencedGroup.id);
            const isSelfReference = referencedGroup.id === currentGroup.id;

            if (hasDirectCircularReference || isSelfReference) {
                console.log(`Direct circular reference between ${currentGroupName} and ${name}`);
                continue;
            }

            if (!referencedGroup.result) {
                console.log(`The result for "${name}" is not set and can't be used by group "${currentGroupName}" when trying to get referenced results`);
                continue;
            }

            combinedReferencedResults = replaceThisGroupReferenceWithResult(name, combinedReferencedResults);
            validReferencedResults.push({ name, result: referencedGroup.result });
        }

        referencedResults = validReferencedResults;
    }


    return { hasReferences: hasReferences, referencedResults, combinedReferencedResults };
}

function displayCombinedReferencedResult(groupElement, combinedReferencedResults) {
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    const dataText = groupElement.querySelector(".data-text");

    console.log(`Displaying the group referenced result in refResultTextarea`);

    refResultTextarea.value = combinedReferencedResults ? combinedReferencedResults : "";
    refResultTextarea.style.display = "block";
    dataText.style.display = "none";

    return combinedReferencedResults;
}



