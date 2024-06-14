function initTrack(trackNode) {
    const listNode = trackNode.getElementsByClassName("track-list")[0];
    const listHeaderNode = listNode.getElementsByClassName("track-list-header")[0];
    const listAddBtnNode = listHeaderNode.querySelector("button[name='btn']");   
    const listItemNodes = [...listNode.getElementsByClassName("track-list-item")];
    
    // Add input liteners
    listAddBtnNode.addEventListener("click", addTrackItem);

    // Remove all list items except for the first, which is our hidden template
    const listTemplateItemNode = listItemNodes[0];
    listTemplateItemNode.style.display = 'none';
    for (let i = 1; i < listItemNodes.length; i++) {
        const item = listItemNodes[i];
        listItemNodes[i].remove();
    } 

    function addTrackItem() {
        const itemNode = listTemplateItemNode.cloneNode(true);
        const removeBtn = itemNode.querySelector("button[name='btn']");
        removeBtn.addEventListener('click', () => itemNode.remove());
        itemNode.removeAttribute('style');
        listNode.appendChild(itemNode);
    }
}

initTrack(document.getElementsByClassName("track")[0]);