/*
leftover todos:
- add "direct edit" dropdowns for exits when in "move" mode
- try another orientation on android fix
- need to update the instructions panel
- tool positioning in portrait mode
- encapsulate adv dialog logic and inventory logic
- encapsulate editor.js and bitsy.js
	- create separate runtime game data and editor game data
- should top bar go away on scroll down? (like some web apps do)
- should tools toggles go in a side-bar?
- saving and loading games in mobile
	- downloading blobs is not supported
	- thought: create "cartridges" out of GIFs (multiple frames means no limit on size even if dimensions are static)
	- store game data text in one byte per RGB pixel (reserve last 85 values in each color value: 85 * 3 = 255)
	- require implementation of lzw decompression and GIF decoding
	- should I create a standalone "bitsy player" page too that takes in the carts?

new notes from forum
- new game+
- process tags in "say" function
*/

/* MODES */
var TileType = {
	Tile : 0,
	Sprite : 1,
	Avatar : 2,
	Item : 3
};

var EditMode = {
	Edit : 0,
	Play : 1
};

var EditorInputMode = {
	Mouse : 0,
	Touch : 1
};
var curEditorInputMode = EditorInputMode.Mouse;

/* EVENTS */
var events = new EventManager();

// TODO: what the heck is this helper function for?
function defParam(param,value) {
	return (param == undefined || param == null) ? value : param;
};

/* PALETTES */
function selectedColorPal() {
	return paletteTool.GetSelectedId();
};

/* UNIQUE ID METHODS */
// TODO - lots of duplicated code around stuff (ex: all these things with IDs)
function nextTileId() {
	return nextObjectId( sortedTileIdList() );
}

function nextSpriteId() {
	return nextObjectId( sortedSpriteIdList() );
}

function nextItemId() {
	return nextObjectId( sortedItemIdList() );
}

function nextRoomId() {
	return nextObjectId( sortedRoomIdList() );
}

function nextPaletteId() {
	return nextObjectId( sortedPaletteIdList() );
}

function nextObjectId(idList) {
	if (idList.length <= 0) {
		return "0";
	}

	var lastId = idList[ idList.length - 1 ];
	var idInt = parseInt( lastId, 36 );
	idInt++;
	return idInt.toString(36);
}

function prevPaletteId() {
    return prevObjectId(sortedPaletteIdList());
}

function prevObjectId(idList) {
    if (idList.length <= 0) {
        return "0";
    }

    var lastId = idList[idList.length - 1];
    var idInt = parseInt(lastId, 36);
    idInt--;
    return idInt.toString(36);
}

function sortedTileIdList() {
	return sortedBase36IdList( tile );
}

function sortedSpriteIdList() {
	return sortedBase36IdList( sprite );
}

function sortedItemIdList() {
	return sortedBase36IdList( item );
}

function sortedRoomIdList() {
	return sortedBase36IdList( room );
}

var specialDialogTags = [];
specialDialogTags.push('DRAWINGSIZE');

function sortedDialogIdList() {
	var keyList = Object.keys(dialog);
	keyList.splice(keyList.indexOf("title"), 1);
	// filter out dialog id for special dialog entries like DATA3D and DRAWINGSIZE
	specialDialogTags.forEach(function (tag) {
        var i = keyList.indexOf(tag);
        if (i !== -1) keyList.splice(i, 1);
	});
	var keyObj = {};
	for (var i = 0; i < keyList.length; i++) {
		keyObj[keyList[i]] = {};
	}

	return sortedBase36IdList(keyObj);
}

function sortedPaletteIdList() {
	var keyList = Object.keys(palette);
	keyList.splice(keyList.indexOf("default"), 1);
	var keyObj = {};
	for (var i = 0; i < keyList.length; i++) {
		keyObj[keyList[i]] = {};
	}

	return sortedBase36IdList(keyObj);
}

function sortedBase36IdList( objHolder ) {
	return Object.keys( objHolder ).sort( function(a,b) { return parseInt(a,36) - parseInt(b,36); } );
}

function nextAvailableDialogId(prefix) {
	return nextObjectId(sortedDialogIdList());
}

function nextObjectHexId(idList) {
	if (idList.length <= 0) {
		return "0";
	}

	var lastId = idList[ idList.length - 1 ];
	var idInt = safeParseHex(lastId);
	idInt++;
	return idInt.toString(16);
}

function sortedHexIdList(objHolder) {
	var objectKeys = Object.keys(objHolder);

	var hexSortFunc = function(key1,key2) {
		return safeParseHex(key1,16) - safeParseHex(key2,16);
	};
	var hexSortedIds = objectKeys.sort(hexSortFunc);

	return hexSortedIds;
}

function safeParseHex(str) {
	var hexInt = parseInt(str,16);
	if (hexInt == undefined || hexInt == null || isNaN(hexInt)) {
		return -1;
	}
	else {
		return hexInt;
	}
}

/* UTILS */
function getContrastingColor(palId) {
	if (!palId) palId = curPal();
	var hsl = rgbToHsl( getPal(palId)[0][0], getPal(palId)[0][1], getPal(palId)[0][2] );
	// console.log(hsl);
	var lightness = hsl[2];
	if (lightness > 0.5) {
		return "#000";
	}
	else {
		return "#fff";
	}
}

function findAndReplaceTileInAllRooms( findTile, replaceTile ) {
	for (roomId in room) {
		for (y in room[roomId].tilemap) {
			for (x in room[roomId].tilemap[y]) {
				if (room[roomId].tilemap[y][x] === findTile) {
					room[roomId].tilemap[y][x] = replaceTile;
				}
			}
		}
	}
}

/* MAKE DRAWING OBJECTS */
function makeTile(id,imageData) {
	var drwId = "TIL_" + id;
	tile[id] = {
		id : id,
		drw : drwId,
		col : 1,
		animation : { //todo
			isAnimated : (!imageData) ? false : (imageData.length>1),
			frameIndex : 0,
			frameCount : (!imageData) ? 2 : (imageData.length),
		},
		name : null
	};
	makeDrawing(drwId,imageData);
}

function makeSprite(id,imageData) {
	var drwId = "SPR_" + id;
	sprite[id] = { //todo create default sprite creation method
		id : id,
		drw : drwId,
		col : 2,
		room : null,
		x : -1,
		y : -1,
		animation : { //todo
			isAnimated : (!imageData) ? false : (imageData.length>1), // more duplication :(
			frameIndex : 0,
			frameCount : (!imageData) ? 2 : (imageData.length),
		},
		dlg : null,
		name : null
	};
	makeDrawing(drwId,imageData);
}

function makeItem(id,imageData) { // NOTE : same as tile right now? make more like sprite?
	// console.log(id);
	var drwId = "ITM_" + id;
	// console.log(drwId);
	item[id] = {
		id : id,
		drw : drwId,
		col : 2, // TODO color not column (bad name)
		animation : { //todo
			isAnimated : (!imageData) ? false : (imageData.length>1), // more duplication :(
			frameIndex : 0,
			frameCount : (!imageData) ? 2 : (imageData.length),
		},
		dlg : null,
		name : null
	};
	makeDrawing(drwId,imageData);
}

/* CUSTOMIZABLE DRAWING SIZE */
function validateNewDrawingSize(newSize) {
	newSize = parseInt(newSize);
	if (isNaN(newSize) || newSize <= 0) {
		console.warn('drawing size ' + newSize + ' is invalid! resetting to 8')
		newSize = 8;
	}
	return newSize;
}

function setNewDrawingSize (newSize) {
	if (!dialog['DRAWINGSIZE']) {
		dialog['DRAWINGSIZE'] = {
	        src: null,
	        name: null,
	    };
	}
	dialog['DRAWINGSIZE'].src = '' + newSize;
	refreshGameData();
}

function getNewDrawingSize () {
	return validateNewDrawingSize(dialog['DRAWINGSIZE'] && dialog['DRAWINGSIZE'].src);
}

function makeDrawing(id,imageData) {
	var newSize = getNewDrawingSize();
	if (!imageData) {
		// initialize with nested array for the first frame
		imageData = [[]];
		for (var y = 0; y < newSize; y++) {
			imageData[0][y] = [];
				for (var x = 0; x < newSize; x++) {
					imageData[0][y][x] = 0;
				}
		}
	}
	// TODO RENDERER : stop using global renderer
	renderer.SetImageSource(id,imageData);
	// TODO RENDERER : re-render images?
}

/* DRAWING SIZE UI */
function onChangeDrawingSize(event) {
	var newSize;
	if (event.target.value === 'custom') {
		newSize = validateNewDrawingSize(document.getElementById('newDrawingSizeCustomInput').value);
		document.getElementById('newDrawingSizeCustomSpan').style.display = 'inline-block';
	} else {
		newSize = validateNewDrawingSize(event.target.value);
		if (event.target.type === 'radio') {
			// if we used a preset attached to a radio button, hide custom size input
			document.getElementById('newDrawingSizeCustomSpan').style.display = 'none';
		} else {
			// if we used an input element for custom size, make sure to overwrite invalid value
			event.target.value = newSize;
		}
	}
	setNewDrawingSize(newSize);
	console.log('changed new drawing size to ' + newSize);
}

function updateDrawingSizeUi() {
	var newSize = getNewDrawingSize();
	if ([8, 16].indexOf(newSize) !== -1) {
		document.getElementById('newDrawingSize' + newSize).checked = true;
		document.getElementById('newDrawingSizeCustomSpan').style.display = 'none';
	} else {
		document.getElementById("newDrawingSizeCustom").checked = true;
		document.getElementById('newDrawingSizeCustomSpan').style.display = 'inline-block';
		document.getElementById('newDrawingSizeCustomInput').value = newSize;
	}
}

// update drawing size ui when loading new game data or when game data is changed
events.Listen("game_data_change", function() {
    updateDrawingSizeUi();
});

/* EVENTS */
function on_change_title(e) {
	setTitle(e.target.value);
	refreshGameData();
	tryWarnAboutMissingCharacters(getTitle());

	// make sure all editors with a title know to update
	events.Raise("dialog_update", { dialogId:titleDialogId, editorId:null });
}

/* MOBILE */
function mobileOffsetCorrection(off,e,innerSize) {
	var bounds = e.target.getBoundingClientRect();

	// var width = bounds.width * containerRatio;
	// var height = bounds.height * containerRatio;

	// correction for square canvas contained in rect
	if( bounds.width > bounds.height ) {
		off.x -= (bounds.width - bounds.height) / 2;
	}
	else if( bounds.height > bounds.width ) {
		off.y -= (bounds.height - bounds.width) / 2;
	}

	// console.log(off);

	// convert container size to internal canvas size
	var containerRatio = innerSize / Math.min( bounds.width, bounds.height );

	// console.log(containerRatio);

	off.x *= containerRatio;
	off.y *= containerRatio;

	// console.log(off);

	return off;
}

// todo : seems like this could be used several places...
// todo : localize
function tileTypeToString(type) {
	if (type == TileType.Tile) {
		return "tile";
	}
	else if (type == TileType.Sprite) {
		return "sprite";
	}
	else if (type == TileType.Avatar) {
		return "avatar";
	}
	else if (type == TileType.Item) {
		return "item";
	}
}

function tileTypeToIdPrefix(type) {
	if (type == TileType.Tile) {
		return "TIL_";
	}
	else if (type == TileType.Sprite || type == TileType.Avatar) {
		return "SPR_";
	}
	else if (type == TileType.Item) {
		return "ITM_";
	}
}

/* DIALOG UI 
- hacky to make this all global
- some of this should be folded into paint tool later
*/
var dialogTool = new DialogTool();
var curDialogEditorId = null; // can I wrap this all up somewhere? -- feels a bit hacky to have all these globals
var curDialogEditor = null;
var curPlaintextDialogEditor = null; // the duplication is a bit weird, but better than recreating editors all the time?
function openDialogTool(dialogId, insertNextToId, showIfHidden) { // todo : rename since it doesn't always "open" it?
	if (showIfHidden === undefined || showIfHidden === null) {
		showIfHidden = true;
	}

	document.getElementById("deleteDialogButton").disabled = dialogId === titleDialogId;

	var showCode = document.getElementById("dialogShowCodeCheck").checked;

	// clean up any existing editors -- is there a more "automagical" way to do this???
	if (curDialogEditor) {
		curDialogEditor.OnDestroy();
		delete curDialogEditor;
	}

	if (curPlaintextDialogEditor) {
		curPlaintextDialogEditor.OnDestroy();
		delete curPlaintextDialogEditor;
	}
	

	curDialogEditorId = dialogId;
	curDialogEditor = dialogTool.CreateEditor(dialogId);
	curPlaintextDialogEditor = dialogTool.CreatePlaintextEditor(dialogId, "largeDialogPlaintextArea");

	var dialogEditorViewport = document.getElementById("dialogEditor");
	dialogEditorViewport.innerHTML = "";

	if (showCode) {
		dialogEditorViewport.appendChild(curPlaintextDialogEditor.GetElement());
	}
	else {
		dialogEditorViewport.appendChild(curDialogEditor.GetElement());
	}

	document.getElementById("dialogName").placeholder = "dialog " + dialogId;
	if (dialogId === titleDialogId) {
		document.getElementById("dialogName").readOnly = true;
		document.getElementById("dialogName").value = titleDialogId;
	}
	else {
		document.getElementById("dialogName").readOnly = false;
		if (dialog[dialogId].name != null) {
			document.getElementById("dialogName").value = dialog[dialogId].name;
		}
		else {
			document.getElementById("dialogName").value = "";
		}
	}

	var isHiddenOrShouldMove = (document.getElementById("dialogPanel").style.display === "none") ||
		(insertNextToId != undefined && insertNextToId != null);

	if (isHiddenOrShouldMove && showIfHidden) {
		console.log("insert next to : " + insertNextToId);
		showPanel("dialogPanel", insertNextToId);
	}
}

// TODO : probably this should be incorporated into the dialog editor main code somehow
function onDialogNameChange(event) {
	if (event.target.value != null && event.target.value.length > 0) {
		dialog[curDialogEditorId].name = event.target.value;
	}
	else {
		dialog[curDialogEditorId].name = null;
	}
	refreshGameData();
}

function nextDialog() {
	var id = titleDialogId; // the title is safe as a default choice

	if (curDialogEditorId != null) {
		var dialogIdList = sortedDialogIdList();
		var dialogIndex = dialogIdList.indexOf(curDialogEditorId);

		// pick the index of the next dialog to open
		dialogIndex++;
		if (dialogIndex >= dialogIdList.length) {
			dialogIndex = -1; // hacky: I'm using -1 to denote the title
		}

		// turn the index into an ID
		if (dialogIndex < 0) {
			id = titleDialogId;
		}
		else {
			id = dialogIdList[dialogIndex];
		}
	}

	openDialogTool(id);

	alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
}

function prevDialog() {
	var id = titleDialogId; // the title is safe as a default choice

	if (curDialogEditorId != null) {
		var dialogIdList = sortedDialogIdList();
		var dialogIndex = dialogIdList.indexOf(curDialogEditorId);

		// pick the index of the next dialog to open
		if (dialogIndex === -1) {
			dialogIndex = dialogIdList.length - 1;
		}
		else {
			dialogIndex--;
		}

		// turn the index into an ID
		if (dialogIndex < 0) {
			id = titleDialogId;
		}
		else {
			id = dialogIdList[dialogIndex];
		}
	}

	console.log("PREV DIALOG " + id);

	openDialogTool(id);

	alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
}

function addNewDialog() {
	var id = nextAvailableDialogId();

	dialog[id] = { src:" ", name:null };
	refreshGameData();

	openDialogTool(id);

	events.Raise("new_dialog", { id:id });

	alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
}

function duplicateDialog() {
	if (curDialogEditorId != null) {
		var id = nextAvailableDialogId();
		dialog[id] = { src:dialog[curDialogEditorId].slice(), name:null };
		refreshGameData();

		openDialogTool(id);

		alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
	}
}

function deleteDialog() {
	var shouldDelete = confirm("Are you sure you want to delete this dialog?");

	if (shouldDelete && curDialogEditorId != null && curDialogEditorId != titleDialogId) {
		var tempDialogId = curDialogEditorId;

		nextDialog();

		// delete all references to deleted dialog (TODO : should this go in a wrapper function somewhere?)
		for (id in sprite) {
			if (sprite[id].dlg === tempDialogId) {
				sprite[id].dlg = null;
			}
		}

		for (id in item) {
			if (item[id].dlg === tempDialogId) {
				item[id].dlg = null;
			}
		}

		for (id in room) {
			for (var i = 0; i < room[id].exits.length; i++) {
				var exit = room[id].exits[i];
				if (exit.dlg === tempDialogId) {
					exit.dlg = null;
				}
			}

			for (var i = 0; i < room[id].endings.length; i++) {
				var end = room[id].endings[i];
				if (end.id === tempDialogId) {
					room[id].endings.splice(i, 1);
					i--;
				}
			}
		}

		delete dialog[tempDialogId];
		refreshGameData();

		alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;

		events.Raise("dialog_delete", { dialogId:tempDialogId, editorId:null });
	}
}

// TODO : move into the paint tool
var paintDialogWidget = null;
function reloadDialogUI() {
	var dialogContent = document.getElementById("dialog");
	dialogContent.innerHTML = "";

	var obj = paintTool.drawing.getEngineObject();

	// clean up previous widget
	if (paintDialogWidget) {
		paintDialogWidget.OnDestroy();
		delete paintDialogWidget;
	}

	paintDialogWidget = dialogTool.CreateWidget(
		"dialog",
		"paintPanel",
		obj.dlg,
		true,
		function(id) {
			obj.dlg = id;
		},
		{
			CreateFromEmptyTextBox: true,
			OnCreateNewDialog: function(id) {
				obj.dlg = id;
				refreshGameData();
			},
			GetDefaultName: function() {
				var desc = paintTool.drawing.getNameOrDescription();
				return CreateDefaultName(desc + " dialog", dialog, true); // todo : localize
			}, // todo : localize
		});
	dialogContent.appendChild(paintDialogWidget.GetElement());

	if (alwaysShowDrawingDialog && dialog[obj.dlg]) {
		openDialogTool(obj.dlg, null, false);
	}
}

// hacky - assumes global paintTool object
function getCurDialogId() {
	return paintTool.drawing.getDialogId();
}

function setDefaultGameState() {
	var defaultData = Resources["defaultGameData.bitsy"];
	// console.log("DEFAULT DATA \n" + defaultData);
	document.getElementById("game_data").value = defaultData;
	localStorage.bitsy_color_game_data = document.getElementById("game_data").value; // save game
	clearGameData();
	parseWorld(document.getElementById("game_data").value); // load game

	// TODO RENDERER : refresh images
	// TODO -- more setup???
}

function newGameDialog() {
	var resetMessage = localization.GetStringOrFallback("reset_game_message", "Starting a new game will erase your old data. Consider exporting your work first! Are you sure you want to start over?");
	if (confirm(resetMessage)) {
		resetGameData();
	}
}

function resetGameData() {
	setDefaultGameState();

	// TODO : localize default_title
	setTitle(localization.GetStringOrFallback("default_title", "Write your game's title here"));
	dialog["0"] = {
		src: localization.GetStringOrFallback("default_sprite_dlg", "I'm a cat"), // hacky to do this in two places :(
		name: "cat dialog", // todo : localize
	};
	dialog["1"] = {
		src: localization.GetStringOrFallback("default_item_dlg", "You found a nice warm cup of tea"),
		name: "tea dialog", // todo : localize
	};

	pickDefaultFontForLanguage(localization.GetLanguage());

	// todo wrap these variable resets in a function
	tileIndex = 0;
	spriteIndex = 0;

	refreshGameData();

	// TODO RENDERER : refresh images
	updateExitOptionsFromGameData();
	updateRoomName();
	updateInventoryUI();
	updateFontSelectUI(); // hmm is this really the place for this?

	on_paint_avatar();
	document.getElementById('paintOptionAvatar').checked = true;

	paintTool.updateCanvas(); // hacky - assumes global paintTool and roomTool
	markerTool.Clear(); // hacky -- should combine more of this stuff together
	markerTool.SetRoom(curRoom);
	markerTool.Refresh();
	roomTool.drawEditMap();

	events.Raise("game_data_change"); // TODO -- does this need to have a specific reset event or flag?
}

function refreshGameData() {
	if (isPlayMode) {
		return; //never store game data while in playmode (TODO: wouldn't be necessary if the game data was decoupled form editor data)
	}

    flags.ROOM_FORMAT = 1; // always save out comma separated format, even if the old format is read in
    flags.DRAW_FORMAT = 1;

	// var gameData = serializeWorld();

	// document.getElementById("game_data").value = gameData; // TODO : this is where the slow down is

	var gameDataNoFonts = serializeWorld(true);
	document.getElementById("game_data").value = showFontDataInGameData ? serializeWorld() : gameDataNoFonts;

	// localStorage.setItem("game_data", gameData); //auto-save

    localStorage.setItem("bitsy_color_game_data", gameDataNoFonts);
}

/* TIMER */
function Timer() {
	var start = Date.now();

	this.Seconds = function() {
		return Math.floor( (Date.now() - start) / 1000 );
	}

	this.Milliseconds = function() {
		return Date.now() - start;
	}
}

var editMode = EditMode.Edit; // TODO : move to core.js?

/* TOOL CONTROLLERS */
var roomTool;
var paintTool;

/* CUR DRAWING */
var drawing = new DrawingId(TileType.Avatar,"A");

var tileIndex = 0;
var spriteIndex = 0;
var itemIndex = 0;

/* ROOM */
var roomIndex = 0;

/* BROWSER COMPATIBILITY */
var browserFeatures = {
	colorPicker : false,
	fileDownload : false,
	blobURL : false
};

/* SCREEN CAPTURE */
var gifencoder = new gif();
var gifFrameData = [];

var isPlayMode = false;

/* EXPORT HTML */
var makeURL = null;
var exporter = new Exporter();

/* FONT MANAGER */
var defaultFonts = [
		"ascii_small.bitsyfont",
		"unicode_european_small.bitsyfont",
		"unicode_european_large.bitsyfont",
		"unicode_asian.bitsyfont",
		"arabic.bitsyfont",
	];
fontManager = new FontManager(defaultFonts); // replaces font manager in the engine with one containing all fonts loaded in the editor

function detectBrowserFeatures() {
	console.log("BROWSER FEATURES");
	//test feature support
	try {
		var input = document.createElement("input");
		input.type = "color";
		document.body.appendChild(input);

		if (input.type === "color") {
			console.log("color picker supported!");
			browserFeatures.colorPicker = true;
		} else {
			browserFeatures.colorPicker = false;
		}

		if(input.offsetWidth <= 10 && input.offsetHeight <= 10) {
			// console.log(input.clientWidth);
			console.log("WEIRD SAFARI COLOR PICKER IS BAD!");
			browserFeatures.colorPicker = false;
			document.getElementById("pageColor").type = "text";
		}
		
		document.body.removeChild(input);
	} catch(e) {
		browserFeatures.colorPicker = false;
	}

	var a = document.createElement('a');
	if (typeof a.download != "undefined") {
		console.log("downloads supported!");
		browserFeatures.fileDownload = true;
	}
	else {
		browserFeatures.fileDownload = false;
	}

	browserFeatures.blobURL = (!!new Blob) && (URL != undefined || webkitURL != undefined);
	if( browserFeatures.blobURL ) {
		console.log("blob supported!");
		makeURL = URL || webkitURL;
	}
}

function hasUnsupportedFeatures() {
	return /*!browserFeatures.colorPicker ||*/ !browserFeatures.fileDownload;
}
// NOTE: No longer relying on color picker feature

function showUnsupportedFeatureWarning() {
	document.getElementById("unsupportedFeatures").style.display = "block";
}

function hideUnsupportedFeatureWarning() {
	document.getElementById("unsupportedFeatures").style.display = "none";
}

// This is the panel arrangement you get if you are new or your editor settings are out-of-date
var defaultPanelPrefs = {
	workspace : [
		{ id:"aboutPanel", 			visible:true, 	position:0  },
		{ id:"roomPanel", 			visible:true, 	position:1  },
		{ id:"paintPanel", 			visible:true, 	position:2  },
		{ id:"colorsPanel", 		visible:true, 	position:3  },
		{ id:"downloadPanel", 		visible:true, 	position:4  },
		{ id:"gifPanel", 			visible:false, 	position:5  },
		{ id:"dataPanel", 			visible:false, 	position:6  },
		{ id:"exitsPanel", 			visible:false, 	position:7  },
		{ id:"paintExplorerPanel",	visible:false,	position:9  },
		{ id:"dialogPanel",			visible:false,	position:10 },
		{ id:"inventoryPanel",		visible:false,	position:11 },
		{ id:"settingsPanel",		visible:false,	position:12 },
	]
};
// console.log(defaultPanelPrefs);

function getPanelPrefs() {
	// (TODO: weird that engine version and editor version are the same??)
	var useDefaultPrefs = ( localStorage.engine_version == null ) ||
                            (localStorage.bitsy_color_panel_prefs == null ) ||
							( JSON.parse(localStorage.engine_version).major < 6 ) ||
							( JSON.parse(localStorage.engine_version).minor < 0 );

	var prefs = useDefaultPrefs ? defaultPanelPrefs : JSON.parse( localStorage.bitsy_color_panel_prefs );

	// add missing panel prefs (if any)
	// console.log(defaultPanelPrefs);
	for( var i = 0; i < defaultPanelPrefs.workspace.length; i++ ) {
		var isMissing = true;
		var panelPref = defaultPanelPrefs.workspace[i];
		for( var j = 0; j < prefs.workspace.length; j++ )
		{
			if( prefs.workspace[j].id === panelPref.id ) {
				isMissing = false;
			}
		}

		if( isMissing ) {
			prefs.workspace.push( panelPref );
		}
	}

	return prefs;
}

var urlFlags = {};
function readUrlFlags() {
	console.log("@@@@@ FLAGGS")
	var urlSplit = window.location.href.split("?");
	if (urlSplit.length > 1) {
		for(var i = 1; i < urlSplit.length; i++) {
			var flagSplit = urlSplit[i].split("=");
			urlFlags[ flagSplit[0] ] = flagSplit[1];
		}
	}
	console.log(urlFlags);
}

function isPortraitOrientation() {
	var isPortrait = false;

	if (window.screen.orientation != undefined) {
		// most browsers
		isPortrait = window.screen.orientation.type.includes("portrait");
	}
	else if (window.orientation != undefined) {
		// iOS safari
		isPortrait = window.orientation == 0 || window.orientation == 180;
	}

	return isPortrait;
}

function start() {
	events.Listen("game_data_change", function(event) {
		updatePaletteOptionsFromGameData();

		// TODO -- over time I can move more things in here
		// on the other hand this is still sort of global thing that we don't want TOO much of

		// force re-load the dialog tool
		openDialogTool(titleDialogId);
	});

	isPlayerEmbeddedInEditor = true; // flag for game player to make changes specific to editor

	var versionLabelElements = document.getElementsByClassName("curVersionLabel");
	for (var labelIndex in versionLabelElements) {
		var versionLabel = versionLabelElements[labelIndex];
		versionLabel.innerText = "v" + version.major + "." + version.minor;
	}

	detectBrowserFeatures();

	readUrlFlags();

	// load icons and replace placeholder elements
	var elements = document.getElementsByClassName("bitsy_icon");
	for(var i = 0; i < elements.length; i++) {
		iconUtils.LoadIcon(elements[i]);
	}

	var elements = document.getElementsByClassName("bitsy_icon_anim");
	for(var i = 0; i < elements.length; i++) {
		iconUtils.LoadIconAnimated(elements[i]);
	}

	// localization
	if (urlFlags["lang"] != null) {
		localStorage.editor_language = urlFlags["lang"]; // need to verify this is real language?
	}
	localization = new Localization();

	//game canvas & context (also the map editor)
	attachCanvas( document.getElementById("game") );

	//init tool controllers
	roomTool = new RoomTool(canvas);
	roomTool.listenEditEvents()
	roomTool.drawing = drawing;
	roomTool.editDrawingAtCoordinateCallback = editDrawingAtCoordinate;

	paintTool = new PaintTool(document.getElementById("paint"),roomTool);
	paintTool.drawing = drawing;
	paintTool.onReloadTile = function(){ reloadTile() };
	paintTool.onReloadSprite = function(){ reloadSprite() };
	paintTool.onReloadItem = function(){ reloadItem() };

	markerTool = new RoomMarkerTool(document.getElementById("markerCanvas1"), document.getElementById("markerCanvas2") );
	console.log("MARKER TOOL " + markerTool);

	roomTool.markers = markerTool;

	//
	drawingThumbnailCanvas = document.createElement("canvas");
	drawingThumbnailCanvas.width = 8 * scale;
	drawingThumbnailCanvas.height = 8 * scale;
	drawingThumbnailCtx = drawingThumbnailCanvas.getContext("2d");

	// load custom font
    if (localStorage.bitsy_color_custom_font != null) {
		var fontStorage = JSON.parse(localStorage.bitsy_color_custom_font);
		fontManager.AddResource(fontStorage.name + ".bitsyfont", fontStorage.fontdata);
	}
	resetMissingCharacterWarning();

	//load last auto-save
    if (localStorage.bitsy_color_game_data) {
		//console.log("~~~ found old save data! ~~~");
		//console.log(localStorage.game_data);
        document.getElementById("game_data").value = localStorage.bitsy_color_game_data;
		on_game_data_change_core();
	}
	else {
		setDefaultGameState();
	}

	roomIndex = sortedRoomIdList().indexOf(curRoom);

	markerTool.SetRoom(curRoom);

	// load panel preferences
	var prefs = getPanelPrefs();
    localStorage.bitsy_color_panel_prefs = JSON.stringify(prefs); // save loaded prefs
	var sortedWorkspace = prefs.workspace.sort( function(a,b) { return a.position - b.position; } );
	var editorContent = document.getElementById("editorContent");
	for(i in sortedWorkspace) {
		var panelSettings = sortedWorkspace[i];
		var panelElement = document.getElementById(panelSettings.id);
		if (panelElement != undefined && panelElement != null) {
			togglePanelCore( panelSettings.id, panelSettings.visible, false /*doUpdatePrefs*/ );
			editorContent.insertBefore( panelElement, null ); //insert on the left
		}
	}

	//draw everything
	on_paint_avatar();
	paintTool.updateCanvas();
	markerTool.Refresh();
	roomTool.drawEditMap();

	updateRoomPaletteSelect(); //dumb to have to specify this here --- wrap up room UI method?
	updateRoomName(); // init the room UI

	document.getElementById("inventoryOptionItem").checked = true; // a bit hacky
	updateInventoryUI();

	// init color picker
	colorPicker = new ColorPicker('colorPickerWheel', 'colorPickerSelect', 'colorPickerSliderThumb', 'colorPickerSliderBg', 'colorPickerHexText');
    paletteTool = new PaletteTool(colorPicker, selectColor,"paletteName"); //,selectColor
    
	events.Listen("palette_change", function(event) {
		refreshGameData();
	});
	events.Listen("palette_list_change", function(event) {
		refreshGameData();
		updatePaletteOptionsFromGameData();
	});

	// init paint explorer
	paintExplorer = new PaintExplorer("paintExplorer",selectPaint);
	paintExplorer.Refresh(TileType.Avatar);
	paintExplorer.ChangeSelection("A");
	paintTool.explorer = paintExplorer;
	paintExplorer.SetDisplayCaptions( true );

	//unsupported feature stuff
	if (hasUnsupportedFeatures() && !isPortraitOrientation()) {
		showUnsupportedFeatureWarning();
	}
	if (!browserFeatures.fileDownload) {
		document.getElementById("downloadHelp").style.display = "block";
	}

	// gif recording init (should this go in its own file?)
	gifCaptureCanvas = document.createElement("canvas");
	gifCaptureCanvas.width = width * scale;
	gifCaptureCanvas.height = width * scale;
	gifCaptureCtx = gifCaptureCanvas.getContext("2d");

	onInventoryChanged = function(id) {
		updateInventoryUI();
	
		// animate to draw attention to change
		document.getElementById("inventoryItem_" + id).classList.add("flash");
		setTimeout(
			function() {
				// reset animations
				document.getElementById("inventoryItem_" + id).classList.remove("flash");
			},
			400
		);
	};

	onVariableChanged = function(id) {
		updateInventoryUI();
	
		// animate to draw attention to change
		document.getElementById("inventoryVariable_" + id).classList.add("flash");
		setTimeout(
			function() {
				// reset animations
				document.getElementById("inventoryVariable_" + id).classList.remove("flash");
			},
			400
		);
	};

	onGameReset = function() {
		updateInventoryUI();
	}

	//color testing
	// on_change_color_bg();
	// on_change_color_tile();
	// on_change_color_sprite();

	// save latest version used by editor (for compatibility)
	localStorage.engine_version = JSON.stringify( version );

	// load saved export settings
    if (localStorage.bitsy_color_export_settings ) {
        export_settings = JSON.parse(localStorage.bitsy_color_export_settings );
		document.getElementById("pageColor").value = export_settings.page_color;
	}

	// TODO : interesting idea but needs work!
	// // try to honor state of all checkboxes from previous session
	// var inputElements = document.getElementsByTagName("input");
	// for (var i in inputElements) {
	// 	if (inputElements[i].type === "checkbox") {
	// 		var checkbox = inputElements[i];
	// 		if (checkbox.checked) {
	// 			console.log(checkbox);
	// 			checkbox.dispatchEvent(new Event("click"));
	// 		}
	// 	}
	// }

	// create title widgets
	var titleTextWidgets = document.getElementsByClassName("titleWidgetContainer");
	for (var i = 0; i < titleTextWidgets.length; i++) {
		var widget = dialogTool.CreateTitleWidget();
		titleTextWidgets[i].appendChild(widget.GetElement());
	}

	// prepare dialog tool
	openDialogTool(titleDialogId); // start with the title open
	alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked;

	initLanguageOptions();
}

function newDrawing() {
	paintTool.newDrawing();
}

function nextTile() {
	var ids = sortedTileIdList();
	tileIndex = (tileIndex + 1) % ids.length;
	drawing.id = ids[tileIndex];
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

function prevTile() {
	var ids = sortedTileIdList();
	tileIndex = (tileIndex - 1) % ids.length;
	if (tileIndex < 0) tileIndex = (ids.length-1);
	drawing.id = ids[tileIndex];
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

function updateRoomName() {
	if (curRoom == null) { 
		return;
	}

	// document.getElementById("roomId").innerHTML = curRoom;
	var roomLabel = localization.GetStringOrFallback("room_label", "room");
	document.getElementById("roomName").placeholder = roomLabel + " " + curRoom;
	if(room[curRoom].name != null) {
		document.getElementById("roomName").value = room[curRoom].name;
	}
	else {
		document.getElementById("roomName").value = "";
	}
}

// TODO : consolidate these function and rename them something nicer
function on_room_name_change() {
	var str = document.getElementById("roomName").value;
	if(str.length > 0) {
		room[curRoom].name = str;
	}
	else {
		room[curRoom].name = null;
	}

	updateNamesFromCurData()

	refreshGameData();
}

function on_drawing_name_change() {
	var str = document.getElementById("drawingName").value;
	var obj = paintTool.getCurObject();
	var oldName = obj.name;
	if(str.length > 0)
		obj.name = str;
	else
		obj.name = null;

	console.log("NEW NAME!");
	console.log(obj);

	updateNamesFromCurData()

	// update display name for thumbnail
	var displayName = obj.name ? obj.name : getCurPaintModeStr() + " " + drawing.id;
	paintExplorer.ChangeThumbnailCaption(drawing.id, displayName);

	// make sure items referenced in scripts update their names
	if(drawing.type === TileType.Item) {
		// console.log("SWAP ITEM NAMES");

		var ItemNameSwapVisitor = function() {
			var didSwap = false;
			this.DidSwap = function() { return didSwap; };

			this.Visit = function(node) {
				// console.log("VISIT!");
				// console.log(node);

				if( node.type != "function" || node.name != "item" )
					return; // not the right type of node
				
				if( node.arguments.length <= 0 || node.arguments[0].type != "literal" )
					return; // no argument available

				if( node.arguments[0].value === oldName ) { // do swap
					node.arguments[0].value = newName;
					didSwap = true;
				}
			};
		};

		var newName = obj.name;
		if(newName === null || newName === undefined) newName = drawing.id;
		if(oldName === null || oldName === undefined) oldName = drawing.id;

		// console.log(oldName + " <-> " + newName);

		if(newName != oldName) {
			for(dlgId in dialog) {
				// console.log("DLG " + dlgId);
				var dialogScript = scriptInterpreter.Parse(dialog[dlgId].src);
				var visitor = new ItemNameSwapVisitor();
				dialogScript.VisitAll(visitor);
				if (visitor.DidSwap()) {
					var newDialog = dialogScript.Serialize();
					if (newDialog.indexOf("\n") > -1) {
						newDialog = '"""\n' + newDialog + '\n"""';
					}
					dialog[dlgId].src = newDialog;
				}
			}
		}

		updateInventoryItemUI();

		// renderPaintThumbnail( drawing.id ); // hacky way to update name
	}

	refreshGameData();
	console.log(names);
}

function on_palette_name_change(event) {
	paletteTool.ChangeSelectedPaletteName(event.target.value);
}

function selectRoom(roomId) {
	console.log("SELECT ROOM " + roomId);

	// ok watch out this is gonna be hacky
	var ids = sortedRoomIdList();

	var nextRoomIndex = -1;
	for (var i = 0; i < ids.length; i++) {
		if (ids[i] === roomId) {
			nextRoomIndex = i;
		}
	}

	if (nextRoomIndex != -1) {
		roomIndex = nextRoomIndex;
		curRoom = ids[roomIndex];
		markerTool.SetRoom(curRoom);
		roomTool.drawEditMap();
		paintTool.updateCanvas();
		updateRoomPaletteSelect();
		paintExplorer.Refresh( paintTool.drawing.type, true /*doKeepOldThumbnails*/ );

		if (drawing.type === TileType.Tile) {
			updateWallCheckboxOnCurrentTile();
		}

		updateRoomName();
	}
}

function nextRoom() {
	var ids = sortedRoomIdList();
	roomIndex = (roomIndex + 1) % ids.length;
	curRoom = ids[roomIndex];
	markerTool.SetRoom(curRoom);
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	updateRoomPaletteSelect();
	paintExplorer.Refresh( paintTool.drawing.type, true /*doKeepOldThumbnails*/ );

	if (drawing.type === TileType.Tile) {
		updateWallCheckboxOnCurrentTile();
	}

	updateRoomName();
}

function prevRoom() {
	var ids = sortedRoomIdList();
	roomIndex--;
	if (roomIndex < 0) roomIndex = (ids.length-1);
	curRoom = ids[roomIndex];
	markerTool.SetRoom(curRoom);
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	updateRoomPaletteSelect();
	paintExplorer.Refresh( paintTool.drawing.type, true /*doKeepOldThumbnails*/ );

	if (drawing.type === TileType.Tile) {
		updateWallCheckboxOnCurrentTile();
	}

	updateRoomName();
}

function duplicateRoom() {
	var copyRoomId = sortedRoomIdList()[roomIndex];
	var roomToCopy = room[ copyRoomId ];

	roomIndex = Object.keys( room ).length;
	var newRoomId = nextRoomId();

	console.log(newRoomId);
	var duplicateTilemap = [];
	for (y in roomToCopy.tilemap) {
		duplicateTilemap.push([]);
		for (x in roomToCopy.tilemap[y]) {
			duplicateTilemap[y].push( roomToCopy.tilemap[y][x] );
		}
	}

	var duplicateExits = [];
	for (i in roomToCopy.exits) {
		var exit = roomToCopy.exits[i];
		duplicateExits.push( duplicateExit( exit ) );
	}

	room[newRoomId] = {
		id : newRoomId,
		tilemap : duplicateTilemap,
		walls : roomToCopy.walls.slice(0),
		exits : duplicateExits,
		endings : roomToCopy.endings.slice(0),
		pal : roomToCopy.pal,
		items : []
	};
	refreshGameData();

	curRoom = newRoomId;
	//console.log(curRoom);
	markerTool.SetRoom(curRoom); // hack to re-find all the markers
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	updateRoomPaletteSelect();

	updateRoomName();

	// add new exit destination option to exits panel
	var select = document.getElementById("exitDestinationSelect");
	var option = document.createElement("option");
	var roomLabel = localization.GetStringOrFallback("room_label", "room");
	option.text = roomLabel + " " + newRoomId;
	option.value = newRoomId;
	select.add(option);
}

function duplicateExit(exit) {
	var newExit = {
		x : exit.x,
		y : exit.y,
		dest : {
			room : exit.dest.room,
			x : exit.dest.x,
			y : exit.dest.y
		},
		transition_effect : exit.transition_effect,
		dlg: exit.dlg,
	}
	return newExit;
}

function newRoom() {
	roomIndex = Object.keys( room ).length;
	var roomId = nextRoomId();

	var palIdList = sortedPaletteIdList();
	var palId = palIdList.length > 0 ? palIdList[0] : "default";

	console.log(roomId);
	room[roomId] = {
		id : roomId,
		tilemap : [
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]
			],
		walls : [],
		exits : [],
		endings : [],
		effects : [],
		pal : palId,
		items : []
	};
	refreshGameData();

	curRoom = roomId;
	//console.log(curRoom);
	markerTool.SetRoom(curRoom);
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	updateRoomPaletteSelect();

	updateRoomName();

	// add new exit destination option to exits panel
	// var select = document.getElementById("exitDestinationSelect");
	// var option = document.createElement("option");
	// var roomLabel = localization.GetStringOrFallback("room_label", "room");
	// option.text = roomLabel + " " + roomId;
	// option.value = roomId;
	// select.add(option);
}

function deleteRoom() {
	if ( Object.keys(room).length <= 1 ) {
		alert("You can't delete your only room!");
	}
	else if ( confirm("Are you sure you want to delete this room? You can't get it back.") ) {
		var roomId = sortedRoomIdList()[roomIndex];

		// delete exits in _other_ rooms that go to this room
		for( r in room )
		{
			if( r != roomId) {
				for( i in room[r].exits )
				{
					if( room[r].exits[i].dest.room === roomId )
					{
						room[r].exits.splice( i, 1 );
					}
				}
			}
		}

		delete room[roomId];

		refreshGameData();

		markerTool.Clear();
		nextRoom();
		roomTool.drawEditMap();
		paintTool.updateCanvas();
		updateRoomPaletteSelect();
		markerTool.Refresh();
		// updateExitOptionsFromGameData();
		//recreate exit options
	}
}

function nextItem() {
	var ids = sortedItemIdList();
	itemIndex = (itemIndex + 1) % ids.length;
	drawing.id = ids[itemIndex];
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

function prevItem() {
	var ids = sortedItemIdList();
	itemIndex = (itemIndex - 1) % ids.length;
	if (itemIndex < 0) itemIndex = (ids.length-1); // loop
	drawing.id = ids[itemIndex];
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

function nextSprite() {
	var ids = sortedSpriteIdList();
	spriteIndex = (spriteIndex + 1) % ids.length;
	if (spriteIndex === 0) spriteIndex = 1; //skip avatar
	drawing.id = ids[spriteIndex];
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

function prevSprite() {
	var ids = sortedSpriteIdList();
	spriteIndex = (spriteIndex - 1) % ids.length;
	if (spriteIndex <= 0) spriteIndex = (ids.length-1); //loop and skip avatar
	drawing.id = ids[spriteIndex];
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

function next() {
	if (drawing.type == TileType.Tile) {
		nextTile();
	}
	else if( drawing.type == TileType.Avatar || drawing.type == TileType.Sprite ) {
		nextSprite();
	}
	else if( drawing.type == TileType.Item ) {
		nextItem();
	}
	paintExplorer.ChangeSelection( drawing.id );
}

function prev() {
	if (drawing.type == TileType.Tile) {
		prevTile();
	}
	else if( drawing.type == TileType.Avatar || drawing.type == TileType.Sprite ) {
		prevSprite();
	}
	else if( drawing.type == TileType.Item ) {
		prevItem();
	}
	paintExplorer.ChangeSelection( drawing.id );
}

function copyDrawingData(sourceDrawingData) {
    var copiedDrawingData = [];

    for (frame in sourceDrawingData) {
        copiedDrawingData.push([]);
        for (y in sourceDrawingData[frame]) {
            copiedDrawingData[frame].push([]);
            for (x in sourceDrawingData[frame][y]) {
                copiedDrawingData[frame][y].push(sourceDrawingData[frame][y][x]);
            }
        }
    }

    return copiedDrawingData;
}

function duplicateDrawing() {
    paintTool.duplicateDrawing();
}

function flipDrawing(dir) {
    paintTool.flipDrawing(dir);
}

function nudgeDrawing(dir) {
    paintTool.nudgeDrawing(dir);
}

function rotateDrawing(dir) {
    paintTool.rotateDrawing(dir);
}

function mirrorDrawing(dir) {
    paintTool.mirrorDrawing(dir);
}

function removeAllItems( id ) {
	function getFirstItemIndex(roomId, itemId) {
		for(var i = 0; i < room[roomId].items.length; i++) {
			if(room[roomId].items[i].id === itemId)
				return i;
		}
		return -1;
	}

	for(roomId in room) {
		var i = getFirstItemIndex(roomId, id );
		while(i > -1) {
			room[roomId].items.splice(i,1);
			i = getFirstItemIndex(roomId, id );
		}
	}
}

function updateAnimationUI() {
	//todo
}

function reloadTile() {
	// animation UI
	if ( tile[drawing.id] && tile[drawing.id].animation.isAnimated ) {
		paintTool.isCurDrawingAnimated = true;
		document.getElementById("animatedCheckbox").checked = true;

		if( paintTool.curDrawingFrameIndex == 0)
		{
			document.getElementById("animationKeyframe1").className = "animationThumbnail left selected";
			document.getElementById("animationKeyframe2").className = "animationThumbnail right unselected";
		}
		else if( paintTool.curDrawingFrameIndex == 1 )
		{
			document.getElementById("animationKeyframe1").className = "animationThumbnail left unselected";
			document.getElementById("animationKeyframe2").className = "animationThumbnail right selected";
		}

		document.getElementById("animation").setAttribute("style","display:block;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_more");
		renderAnimationPreview( drawing.id );
	}
	else {
		paintTool.isCurDrawingAnimated = false;
		document.getElementById("animatedCheckbox").checked = false;
		document.getElementById("animation").setAttribute("style","display:none;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_less");
	}

	// wall UI
	updateWallCheckboxOnCurrentTile();

	updateDrawingNameUI(true);

	paintTool.updateCanvas();
}

function updateWallCheckboxOnCurrentTile() {
	var isCurTileWall = false;

	if( tile[ drawing.id ].isWall == undefined || tile[ drawing.id ].isWall == null ) {
		if (room[curRoom]) {
			isCurTileWall = (room[curRoom].walls.indexOf(drawing.id) != -1);
		}
	}
	else {
		isCurTileWall = tile[ drawing.id ].isWall;
	}

	if (isCurTileWall) {
		document.getElementById("wallCheckbox").checked = true;
		iconUtils.LoadIcon(document.getElementById("wallCheckboxIcon"), "wall_on");
	}
	else {
		document.getElementById("wallCheckbox").checked = false;
		iconUtils.LoadIcon(document.getElementById("wallCheckboxIcon"), "wall_off");
	}
}

function reloadSprite() {
	// animation UI
	if ( sprite[drawing.id] && sprite[drawing.id].animation.isAnimated ) {
		paintTool.isCurDrawingAnimated = true;
		document.getElementById("animatedCheckbox").checked = true;

		if( paintTool.curDrawingFrameIndex == 0)
		{
			document.getElementById("animationKeyframe1").className = "animationThumbnail left selected";
			document.getElementById("animationKeyframe2").className = "animationThumbnail right unselected";
		}
		else if( paintTool.curDrawingFrameIndex == 1 )
		{
			document.getElementById("animationKeyframe1").className = "animationThumbnail left unselected";
			document.getElementById("animationKeyframe2").className = "animationThumbnail right selected";
		}

		document.getElementById("animation").setAttribute("style","display:block;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_more");
		renderAnimationPreview( drawing.id );
	}
	else {
		paintTool.isCurDrawingAnimated = false;
		document.getElementById("animatedCheckbox").checked = false;
		document.getElementById("animation").setAttribute("style","display:none;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_less");
	}

	// dialog UI
	reloadDialogUI()

	updateDrawingNameUI( drawing.id != "A" );

	// update paint canvas
	paintTool.updateCanvas();

}

// TODO consolidate these drawing related methods
function reloadItem() {
	// animation UI
	if ( item[drawing.id] && item[drawing.id].animation.isAnimated ) {
		paintTool.isCurDrawingAnimated = true;
		document.getElementById("animatedCheckbox").checked = true;

		if( paintTool.curDrawingFrameIndex == 0)
		{
			document.getElementById("animationKeyframe1").className = "animationThumbnail left selected";
			document.getElementById("animationKeyframe2").className = "animationThumbnail right unselected";
		}
		else if( paintTool.curDrawingFrameIndex == 1 )
		{
			document.getElementById("animationKeyframe1").className = "animationThumbnail left unselected";
			document.getElementById("animationKeyframe2").className = "animationThumbnail right selected";
		}

		document.getElementById("animation").setAttribute("style","display:block;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_more");
		renderAnimationPreview( drawing.id );
	}
	else {
		paintTool.isCurDrawingAnimated = false;
		document.getElementById("animatedCheckbox").checked = false;
		document.getElementById("animation").setAttribute("style","display:none;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_less");
	}

	// dialog UI
	reloadDialogUI()

	updateDrawingNameUI(true);

	// update paint canvas
	paintTool.updateCanvas();

}

function deleteDrawing() {
	paintTool.deleteDrawing();
}

function toggleToolBar(e) {
	if( e.target.checked ) {
		document.getElementById("toolsPanel").style.display = "flex";
	}
	else {
		document.getElementById("toolsPanel").style.display = "none";
	}
}

function toggleDownloadOptions(e) {
	if( e.target.checked ) {
		document.getElementById("downloadOptions").style.display = "block";
		iconUtils.LoadIcon(document.getElementById("downloadOptionsCheckIcon"), "expand_more");
	}
	else {
		document.getElementById("downloadOptions").style.display = "none";
		iconUtils.LoadIcon(document.getElementById("downloadOptionsCheckIcon"), "expand_less");
	}
}

function on_edit_mode() {
	isPlayMode = false;
	stopGame();
	// TODO I should really do more to separate the editor's game-data from the engine's game-data
	parseWorld(document.getElementById("game_data").value); //reparse world to account for any changes during gameplay

	curRoom = sortedRoomIdList()[roomIndex]; //restore current room to pre-play state

	roomTool.drawEditMap();
	roomTool.listenEditEvents();

	markerTool.RefreshKeepSelection();

	reloadDialogUI();

	updateInventoryUI();

	if(isPreviewDialogMode) {
		isPreviewDialogMode = false;
		updatePreviewDialogButton();

		// TODO : rework dialog highlighting
		// for(var i = 0; i < advDialogUIComponents.length; i++) {
		// 	advDialogUIComponents[i].GetEl().classList.remove("highlighted");
		// }
	}
	document.getElementById("previewDialogCheck").disabled = false;

	events.Raise("on_edit_mode");
}

// hacky - part of hiding font data from the game data
function getFullGameData() {
	// return document.getElementById("game_data").value + fontManager.GetData(fontName);
	return serializeWorld();
}

function on_play_mode() {
	isPlayMode = true;

	roomTool.unlistenEditEvents();

	// load_game(document.getElementById("game_data").value, !isPreviewDialogMode /* startWithTitle */);
	load_game(getFullGameData(), !isPreviewDialogMode /* startWithTitle */);

	console.log("PLAY!! ~~ PREVIEW ? " + isPreviewDialogMode);
	if(!isPreviewDialogMode) {
		console.log("DISALBE PREVIEW!!!");
		document.getElementById("previewDialogCheck").disabled = true;
	}
}

function updatePlayModeButton() {
	document.getElementById("playModeCheck").checked = isPlayMode;
	iconUtils.LoadIcon(document.getElementById("playModeIcon"), isPlayMode ? "stop" : "play");

	var stopText = localization.GetStringOrFallback("stop_game", "stop");
	var playText = localization.GetStringOrFallback("play_game", "play");
	document.getElementById("playModeText").innerHTML = isPlayMode ? stopText : playText;
}

function updatePreviewDialogButton() {
	document.getElementById("previewDialogCheck").checked = isPreviewDialogMode;
	iconUtils.LoadIcon(document.getElementById("previewDialogIcon"), isPreviewDialogMode ? "stop" : "play");

	var stopText = localization.GetStringOrFallback("stop_game", "stop");
	var previewText = localization.GetStringOrFallback("dialog_start_preview", "preview");
	document.getElementById("previewDialogText").innerHTML = isPreviewDialogMode ? stopText : previewText;
}

function togglePaintGrid(e) {
	paintTool.drawPaintGrid = e.target.checked;
	iconUtils.LoadIcon(document.getElementById("paintGridIcon"), paintTool.drawPaintGrid ? "visibility" : "visibility_off");
	paintTool.updateCanvas();
}

function togglePaintGrid(e) {
    paintTool.drawPaintGrid = e.target.checked;
    iconUtils.LoadIcon(document.getElementById("paintGridIcon"), paintTool.drawPaintGrid ? "visibility" : "visibility_off");
    paintTool.updateCanvas();
}

function toggleMapGrid(e) {
	roomTool.drawMapGrid = e.target.checked;
	iconUtils.LoadIcon(document.getElementById("roomGridIcon"), roomTool.drawMapGrid ? "visibility" : "visibility_off");
	roomTool.drawEditMap();
}

function toggleCollisionMap(e) {
	roomTool.drawCollisionMap = e.target.checked;
	iconUtils.LoadIcon(document.getElementById("roomWallsIcon"), roomTool.drawCollisionMap ? "visibility" : "visibility_off");
	roomTool.drawEditMap();
}

var showFontDataInGameData = false;
function toggleFontDataVisibility(e) {
	showFontDataInGameData = e.target.checked;
	iconUtils.LoadIcon(document.getElementById("fontDataIcon"), e.target.checked ? "visibility" : "visibility_off");
	refreshGameData(); // maybe a bit expensive
}

/* PALETTE STUFF */
var colorPicker = null;
var paletteTool = null;
var paintExplorer = null;

function updateRoomPaletteSelect() {
	var palOptions = document.getElementById("roomPaletteSelect").options;
	for (i in palOptions) {
		var o = palOptions[i];
		// console.log(o);
		if (o.value === curPal()) {
			o.selected = true;
		}
	}
}

function changeColorPickerIndex(index) {
	paletteTool.changeColorPickerIndex(index);
}

function updatePaletteOptionsFromGameData() {
	if (curRoom == null) {
		return;
	}

	var select = document.getElementById("roomPaletteSelect");

	// first, remove all current options
	var i;
	for(i = select.options.length - 1 ; i >= 0 ; i--) {
		select.remove(i);
	}

	// then, add an option for each room
	var paletteLabel = localization.GetStringOrFallback("palette_label", "palette");
	for (palId in palette) {
		if (palId != "default") {
			var option = document.createElement("option");
			option.text = palette[palId].name ? palette[palId].name : paletteLabel + " " + palId;
			option.value = palId;
			option.selected = ( palId === room[ curRoom ].pal );
			select.add(option);
		}
	}
}

function prevPalette() {
	paletteTool.SelectPrev();
}

function nextPalette() {
	paletteTool.SelectNext();
}

function newPalette() {
	paletteTool.AddNew();
}

function duplicatePalette() {
	paletteTool.AddDuplicate();
}

function deletePalette() {
	paletteTool.DeleteSelected();
}

function addColor() {
    paletteTool.AddColor();
}

function roomPaletteChange(event) {
	var palId = event.target.value;
	room[curRoom].pal = palId;
	refreshGameData();
	markerTool.SetRoom(curRoom);
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	paintExplorer.Refresh( paintTool.drawing.type, true /*doKeepOldThumbnails*/ );
}

function updateDrawingNameUI() {
	var obj = paintTool.getCurObject();

	if (drawing.type == TileType.Avatar) { // hacky
		document.getElementById("drawingName").value = "avatar"; // TODO: localize
	}
	else if (obj.name != null) {
		document.getElementById("drawingName").value = obj.name;
	}
	else {
		document.getElementById("drawingName").value = "";
	}

	document.getElementById("drawingName").placeholder = getCurPaintModeStr() + " " + drawing.id;

	document.getElementById("drawingName").readOnly = (drawing.type == TileType.Avatar);
}

function on_paint_avatar() {
	drawing.type = TileType.Avatar;
	drawing.id = "A";
	paintTool.reloadDrawing();
	if(paintExplorer != null) { 
		paintExplorer.Refresh( paintTool.drawing.type );
		paintExplorer.ChangeSelection( paintTool.drawing.id );
	}

	on_paint_avatar_ui_update();
}

function on_paint_avatar_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:none;");
	document.getElementById("wall").setAttribute("style","display:none;");
	// TODO : make navigation commands un-clickable
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(false);
	document.getElementById("paintOptionAvatar").checked = true;
	document.getElementById("paintExplorerOptionAvatar").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:none;");
	document.getElementById("paintExplorerAdd").setAttribute("style","display:none;");
	document.getElementById("paintExplorerFilterInput").value = "";

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = true;
	}
}

function on_paint_tile() {
	drawing.type = TileType.Tile;
	tileIndex = 0;
	drawing.id = sortedTileIdList()[tileIndex];
	paintTool.reloadDrawing();
	paintExplorer.Refresh( paintTool.drawing.type );
	paintExplorer.ChangeSelection( paintTool.drawing.id );

	on_paint_tile_ui_update();
}

function on_paint_tile_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:none;");
	document.getElementById("wall").setAttribute("style","display:block;");
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(true);
	//document.getElementById("animation").setAttribute("style","display:block;");
	document.getElementById("paintOptionTile").checked = true;
	document.getElementById("paintExplorerOptionTile").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:none;");
	document.getElementById("paintExplorerAdd").setAttribute("style","display:inline-block;");
	document.getElementById("paintExplorerFilterInput").value = "";

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = false;
	}
}

function on_paint_sprite() {
	drawing.type = TileType.Sprite;
	if (sortedSpriteIdList().length > 1)
	{
		spriteIndex = 1;
	}
	else {
		spriteIndex = 0; //fall back to avatar if no other sprites exist
	}
	drawing.id = sortedSpriteIdList()[spriteIndex];
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
	paintExplorer.Refresh( paintTool.drawing.type );
	paintExplorer.ChangeSelection( paintTool.drawing.id );

	on_paint_sprite_ui_update();
}

function on_paint_sprite_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:block;");
	document.getElementById("wall").setAttribute("style","display:none;");
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(true);
	//document.getElementById("animation").setAttribute("style","display:block;");
	document.getElementById("paintOptionSprite").checked = true;
	document.getElementById("paintExplorerOptionSprite").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:none;");
	document.getElementById("paintExplorerAdd").setAttribute("style","display:inline-block;");
	document.getElementById("paintExplorerFilterInput").value = "";

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = false;
	}
}

function on_paint_item() {
	console.log("PAINT ITEM");
	drawing.type = TileType.Item;
	itemIndex = 0;
	drawing.id = sortedItemIdList()[itemIndex];
	console.log(drawing.id);
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
	paintExplorer.Refresh( paintTool.drawing.type );
	paintExplorer.ChangeSelection( paintTool.drawing.id );

	on_paint_item_ui_update();
}

function on_paint_item_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:block;");
	document.getElementById("wall").setAttribute("style","display:none;");
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(true);
	//document.getElementById("animation").setAttribute("style","display:block;");
	document.getElementById("paintOptionItem").checked = true;
	document.getElementById("paintExplorerOptionItem").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:inline-block;");
	document.getElementById("paintExplorerAdd").setAttribute("style","display:inline-block;");
	document.getElementById("paintExplorerFilterInput").value = "";

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = false;
	}
}

function paintExplorerFilterChange( e ) {
	console.log("paint explorer filter : " + e.target.value);
	paintExplorer.Refresh( paintTool.drawing.type, true, e.target.value );
}

function editDrawingAtCoordinate(x,y) {
	var spriteId = getSpriteAt(x,y); // todo: need more consistency with these methods
	// console.log(spriteId);
	if(spriteId) {
		if(spriteId === "A") {
			on_paint_avatar_ui_update();
		}
		else {
			on_paint_sprite_ui_update();
		}

		var drawing = new DrawingId( spriteId === "A" ? TileType.Avatar : TileType.Sprite, spriteId );
		paintTool.selectDrawing( drawing );
		paintExplorer.RefreshAndChangeSelection( drawing );
		return;
	}

	var item = getItem(curRoom,x,y);
	// console.log(item);
	if(item) {
		on_paint_item_ui_update();
		var drawing = new DrawingId( TileType.Item, item.id );
		paintTool.selectDrawing( drawing );
		paintExplorer.RefreshAndChangeSelection( drawing );
		return;
	}

	var tileId = getTile(x,y);
	// console.log(tileId);
	if(tileId != 0) {
		on_paint_tile_ui_update(); // really wasteful probably
		var drawing = new DrawingId( TileType.Tile, tileId );
		paintTool.selectDrawing( drawing );
		paintExplorer.RefreshAndChangeSelection( drawing );
		return;
	}
}

var animationThumbnailRenderer = new ThumbnailRenderer();
function renderAnimationThumbnail(imgId,id,frameIndex) {
	var drawingId = new DrawingId(drawing.type,id); // HACK!!! - need consistency on how type + id should be coupled
	animationThumbnailRenderer.Render(imgId,drawingId,frameIndex);
}

function renderAnimationPreview(id) {
	// console.log("RENDRE ANIM PREVIW");
	renderAnimationThumbnail( "animationThumbnailPreview", id );
	renderAnimationThumbnail( "animationThumbnailFrame1", id, 0 );
	renderAnimationThumbnail( "animationThumbnailFrame2", id, 1 );
}
function selectColor() {
    console.log(this);
    var colors = getPal(paletteTool.GetSelectedId());
    var lastIndex = colors.length - 1;
    if (this.value === undefined || this.value === null || this.value > lastIndex) {
        paintTool.setPaintColor(0);
        paletteTool.changeColorPickerIndex(0);
    } else {
        paintTool.setPaintColor(this.value);
        paletteTool.changeColorPickerIndex(this.value);
    }
}

function selectPaint() {
    console.log(this);
	if (drawing.id === this.value) {
		showPanel("paintPanel", "paintExplorerPanel");
	}

	drawing.id = this.value;
	if( drawing.type === TileType.Tile ) {
		tileIndex = sortedTileIdList().indexOf( drawing.id );
		paintTool.reloadDrawing();
	}
	else if( drawing.type === TileType.Item ) {
		itemIndex = sortedItemIdList().indexOf( drawing.id );
		paintTool.reloadDrawing();
	}
	else {
		spriteIndex = sortedSpriteIdList().indexOf( drawing.id );
		paintTool.reloadDrawing();
	}
}

function getCurPaintModeStr() {
	if(drawing.type == TileType.Sprite || drawing.type == TileType.Avatar) {
		return localization.GetStringOrFallback("sprite_label", "sprite");
	}
	else if(drawing.type == TileType.Item) {
		return localization.GetStringOrFallback("item_label", "item");
	}
	else if(drawing.type == TileType.Tile) {
		return localization.GetStringOrFallback("tile_label", "tile");
	}
}

function on_change_adv_dialog() {
	on_change_dialog();
}

function on_game_data_change() {
	on_game_data_change_core();

	refreshGameData();

	// ui stuff
	markerTool.Refresh(); // wow I hope this doesn't cause bugs
	updateRoomName();
	refreshGameData();
}

function on_game_data_change_core() {
	console.log(document.getElementById("game_data").value);

	clearGameData();
	var version = parseWorld(document.getElementById("game_data").value); //reparse world if user directly manipulates game data

	var curPaintMode = drawing.type; //save current paint mode (hacky)

	//fallback if there are no tiles, sprites, map
	// TODO : switch to using stored default file data (requires separated parser / game data code)
	if (Object.keys(sprite).length == 0) {
		drawing.type = TileType.Avatar;
		drawing.id = "A";
		makeSprite(drawing.id);
		sprite["A"].room = null;
		sprite["A"].x = -1;
		sprite["A"].y = -1;
	}
	if (Object.keys(tile).length == 0) {
		drawing.type = TileType.Tile;
		drawing.id = "a";
		makeTile(drawing.id);
	}
	// if (Object.keys(room).length == 0) {
	// 	room["0"] = {
	// 		id : "0",
	// 		tilemap : [
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
	// 				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]
	// 			],
	// 		walls : [],
	// 		exits : [],
	// 		pal : "0"
	// 	};
	// }
	if (Object.keys(item).length == 0) {
		drawing.type = TileType.Item;
		drawing.id = "0";
		makeItem( drawing.id );
	}

	// TODO RENDERER : refresh images

	roomTool.drawEditMap();

	drawing.type = curPaintMode;
	if (drawing.type == TileType.Tile) {
		drawing.id = sortedTileIdList()[0];
	}
	else if (drawing.type === TileType.Item) {
		drawing.id = sortedItemIdList()[0];
	}
	else if (drawing.type === TileType.Avatar) {
		drawing.id = "A";
	}
	else if (drawing.type === TileType.Sprite) {
		drawing.id = sortedSpriteIdList().filter(function (id) { return id != "A"; })[0];
	}
	paintTool.reloadDrawing();

	// if user pasted in a custom font into game data - update the stored custom font
	if (defaultFonts.indexOf(fontName + fontManager.GetExtension()) == -1) {
		var fontStorage = {
			name : fontName,
			fontdata : fontManager.GetData(fontName)
		};
        localStorage.bitsy_color_custom_font = JSON.stringify(fontStorage);
	}

	updateInventoryUI();

	updateFontSelectUI();

	markerTool.SetRoom(curRoom);

	// TODO -- start using this for more things
	events.Raise("game_data_change");
}

function updateFontSelectUI() {
	var fontStorage = null;
    if (localStorage.bitsy_color_custom_font != null) {
        fontStorage = JSON.parse(localStorage.bitsy_color_custom_font);
	}

	var fontSelect = document.getElementById("fontSelect");

	for (var i in fontSelect.options) {
		var fontOption = fontSelect.options[i];
		var fontOptionName = (fontOption.value === "custom" && fontStorage != null) ? fontStorage.name : fontOption.value;
		fontOption.selected = fontOptionName === fontName;

		if (fontOption.value === "custom" && fontStorage != null) {
			var textSplit = fontOption.text.split("-");
			fontOption.text = textSplit[0] + "- " + fontStorage.name;
		}
	}

	updateFontDescriptionUI();
	updateTextDirectionSelectUI(); // a bit hacky but probably ok?
	updateEditorTextDirection(textDirection); // EXTREMELY hack :(
}

function updateFontDescriptionUI() {
	for (var i in fontSelect.options) {
		var fontOption = fontSelect.options[i];
		var fontDescriptionId = fontOption.value + "_description";
		// console.log(fontDescriptionId);
		var fontDescription = document.getElementById(fontDescriptionId);
		if (fontDescription != null) {
			fontDescription.style.display = fontOption.selected ? "block" : "none";
		}
	}
}

function updateExitOptionsFromGameData() {
	// TODO ???
}

function on_toggle_wall(e) {
	paintTool.toggleWall( e.target.checked );
}

function toggleWallUI(checked) {
	iconUtils.LoadIcon(document.getElementById("wallCheckboxIcon"), checked ? "wall_on" : "wall_off");
}

function filenameFromGameTitle() {
	var filename = getTitle().replace(/[^a-zA-Z]/g, "_"); // replace non alphabet characters
	filename = filename.toLowerCase();
	filename = filename.substring(0,32); // keep it from getting too long
	return filename;
}

function exportGame() {
	if (isPlayMode) {
		alert("You can't download your game while you're playing it! Sorry :(");
		return;
	}

	refreshGameData(); //just in case
	// var gameData = document.getElementById("game_data").value; //grab game data
	var gameData = getFullGameData();
	var size = document.getElementById("exportSizeFixedInput").value;
	//download as html file
	exporter.exportGame(
		gameData,
		getTitle(),
		export_settings.page_color,
		filenameFromGameTitle() + ".html",
		isFixedSize,
		size);
}

function exportGameData() {
	refreshGameData(); //just in case
	// var gameData = document.getElementById("game_data").value; //grab game data
	var gameData = getFullGameData();
	ExporterUtils.DownloadFile(filenameFromGameTitle() + ".bitsy", gameData);
}

function exportFont() {
	var fontData = fontManager.GetData(fontName);
	ExporterUtils.DownloadFile( fontName + ".bitsyfont", fontData );
}

function hideAbout() {
	document.getElementById("aboutPanel").setAttribute("style","display:none;");
}

function toggleInstructions(e) {
	var div = document.getElementById("instructions");
	if (e.target.checked) {
		div.style.display = "block";
	}
	else {
		div.style.display = "none";
	}
	iconUtils.LoadIcon(document.getElementById("instructionsCheckIcon"), e.target.checked ? "expand_more" : "expand_less");
}

//todo abstract this function into toggleDiv
function toggleVersionNotes(e) {
	var div = document.getElementById("versionNotes");
	if (e.target.checked) {
		div.style.display = "block";
	}
	else {
		div.style.display = "none";
	}
	iconUtils.LoadIcon(document.getElementById("versionNotesCheckIcon"), e.target.checked ? "expand_more" : "expand_less");
}

/* MARKERS (exits & endings) */
var markerTool;

function startAddMarker() {
	markerTool.StartAdd();
}

function cancelAddMarker() {
	markerTool.CancelAdd();
}

function newExit() {
	markerTool.AddExit(false);
	roomTool.drawEditMap();
}

function newExitOneWay() {
	markerTool.AddExit(true);
	roomTool.drawEditMap();
}

function newEnding() {
	markerTool.AddEnding();
	roomTool.drawEditMap();
}

function duplicateMarker() {
	markerTool.DuplicateSelected();
	roomTool.drawEditMap(); // TODO : this should be triggered by an event really
}

function deleteMarker() {
	markerTool.RemoveMarker();
	roomTool.drawEditMap();
}

function prevMarker() {
	markerTool.NextMarker();
	roomTool.drawEditMap();
}

function nextMarker() {
	markerTool.PrevMarker();
	roomTool.drawEditMap();
}

function toggleMoveMarker1(e) {
	markerTool.TogglePlacingFirstMarker(e.target.checked);
}

function selectMarkerRoom1() {
	markerTool.SelectMarkerRoom1();
}

function toggleMoveMarker2(e) {
	markerTool.TogglePlacingSecondMarker(e.target.checked);
}

function selectMarkerRoom2() {
	markerTool.SelectMarkerRoom2();
}

function changeExitDirection() {
	markerTool.ChangeExitLink();
	roomTool.drawEditMap();
}

function onEffectTextChange(event) {
	markerTool.ChangeEffectText(event.target.value);
}

function showMarkers() {
	toggleRoomMarkers(true);
}

function hideMarkers() {
	toggleRoomMarkers(false);
}

function toggleRoomMarkers(visible) {
	if (visible) {
		markerTool.Refresh();
	}
	roomTool.areMarkersVisible = visible;
	roomTool.drawEditMap();
	document.getElementById("roomMarkersCheck").checked = visible;
	iconUtils.LoadIcon(document.getElementById("roomMarkersIcon"), visible ? "visibility" : "visibility_off");
}

function onChangeExitTransitionEffect(effectId, exitIndex) {
	markerTool.ChangeExitTransitionEffect(effectId, exitIndex);
}

function toggleExitOptions(exitIndex, visibility) {
	if (exitIndex == 0) {
		// hacky way to keep these in syncs!!!
		document.getElementById("exitOptionsToggleCheck1").checked = visibility;
		document.getElementById("exitOptionsToggleCheck1_alt").checked = visibility;
	}
	markerTool.ToggleExitOptions(exitIndex, visibility);
}

// TODO : put helper method somewhere more.. helpful
function setElementClass(elementId, classId, addClass) {
	var el = document.getElementById(elementId);
	if (addClass) {
		el.classList.add(classId);
	}
	else {
		el.classList.remove(classId);
	}
	console.log(el.classList);
}

function togglePanelAnimated(e) {
	var panel = document.getElementById(e.target.value);
	if (e.target.checked) {
		togglePanel(e);
		panel.classList.add("drop");
		setTimeout( function() { panel.classList.remove("drop"); }, 300 );
	}
	else {
		panel.classList.add("close");
		setTimeout(
			function() {
				togglePanel(e);
				panel.classList.remove("close");
			},
			400
		);
	}
}

function togglePanel(e) {
	togglePanelCore( e.target.value, e.target.checked );
}

function showPanel(id, insertNextToId) {
	togglePanelCore(id, true /*visible*/, true /*doUpdatePrefs*/, insertNextToId);
}

function hidePanel(id) {
	// animate panel and tools button
	document.getElementById(id).classList.add("close");
	document.getElementById("toolsCheckLabel").classList.add("flash");

	setTimeout(
		function() {
			// close panel after animations
			togglePanelCore( id, false /*visible*/ );

			// reset animations
			document.getElementById(id).classList.remove("close");
			document.getElementById("toolsCheckLabel").classList.remove("flash");
		},
		400
	);
}

function togglePanelCore(id, visible, doUpdatePrefs, insertNextToId) {
	if (doUpdatePrefs === undefined || doUpdatePrefs === null) {
		doUpdatePrefs = true;
	}

	//hide/show panel
	togglePanelUI(id, visible, insertNextToId);
	//any side effects
	afterTogglePanel(id, visible);
	//save panel preferences
	// savePanelPref( id, visible );
	if (doUpdatePrefs) {
		updatePanelPrefs();
	}
}

function togglePanelUI(id, visible, insertNextToId) {
	if (visible) {
		var editorContent = document.getElementById("editorContent");
		var cardElement = document.getElementById(id);

		if (insertNextToId === undefined || insertNextToId === null) {
			editorContent.appendChild(cardElement);
		}
		else {
			var insertNextToElement = document.getElementById(insertNextToId);
			editorContent.insertBefore(cardElement, insertNextToElement.nextSibling);

			// hack - activate animation if using insert next to?
			cardElement.classList.add("drop");
			setTimeout( function() { cardElement.classList.remove("drop"); }, 300 );
		}
	}

	document.getElementById(id).style.display = visible ? "inline-block" : "none";

	if (visible) {
		cardElement.scrollIntoView();
	}

	// update checkbox
	if (id != "toolsPanel") {
		document.getElementById(id.replace("Panel","Check")).checked = visible;
	}
}

function afterTogglePanel(id,visible) {
	if (visible) {
		afterShowPanel(id);
	}
	else {
		afterHidePanel(id);
	}
}

// TODO : change into event!
function afterShowPanel(id) {
	if (id === "exitsPanel") {
		showMarkers();
	}
}

function afterHidePanel(id) {
	if (id === "exitsPanel") {
		hideMarkers();
	}
}

// DEPRECATED
function savePanelPref(id,visible) {
    var prefs = localStorage.bitsy_color_panel_prefs == null ? {} : JSON.parse(localStorage.bitsy_color_panel_prefs );
	prefs[id] = visible;
    localStorage.setItem( "bitsy_color_panel_prefs", JSON.stringify(prefs) );
}

function updatePanelPrefs() {
	// console.log("UPDATE PREFS");

	var prefs = getPanelPrefs();
	// console.log(prefs);

	var editorContent = document.getElementById("editorContent");
	var cards = editorContent.getElementsByClassName("panel");

	for(var i = 0; i < cards.length; i++) {
		var card = cards[i];
		var id = card.id;
		var visible = card.style.display != "none";

		for (var j = 0; j < prefs.workspace.length; j++ )
		{
			if (prefs.workspace[j].id === id) {
				prefs.workspace[j].position = i;
				prefs.workspace[j].visible = visible;
			}
		}
	}

	// console.log(prefs);
    localStorage.bitsy_color_panel_prefs = JSON.stringify( prefs );
	// console.log(localStorage.panel_prefs);
}


var gifRecordingInterval = null;
function startRecordingGif() {
	gifFrameData = [];

	document.getElementById("gifStartButton").style.display="none";
	document.getElementById("gifSnapshotButton").style.display="none";
	document.getElementById("gifSnapshotModeButton").style.display="none";
	document.getElementById("gifStopButton").style.display="inline";
	document.getElementById("gifRecordingText").style.display="inline";
	document.getElementById("gifPreview").style.display="none";
	document.getElementById("gifPlaceholder").style.display="block";

	gifRecordingInterval = setInterval( function() {
		gifFrameData.push( ctx.getImageData(0,0,512,512).data );
	}, 100 );
}

var gifCaptureCanvas; // initialized in start() -- should be in own module?
var gifCaptureCtx;
var gifCaptureWidescreenSize = {
	width : 726, // height * 1.26
	height : 576
};

var isGifSnapshotLandscape = false;
function toggleSnapshotMode() {
	isGifSnapshotLandscape = !isGifSnapshotLandscape;

	var modeDesc = isGifSnapshotLandscape ? "snapshot mode: landscape" : "snapshot mode: square";
	document.getElementById("gifSnapshotModeButton").title = modeDesc;

	var iconName = isGifSnapshotLandscape ? "pagesize_landscape" : "pagesize_full";
	iconUtils.LoadIcon(document.getElementById("gifSnapshotModeIcon"), iconName);
}

function takeSnapshotGif(e) {
	var gif = {
		frames: [],
		width: 512,
		height: 512,
		loops: 0,
		delay: animationTime / 10
	};

	gifCaptureCanvas.width = 512; // stop hardcoding 512?
	gifCaptureCanvas.height = 512;

	drawRoom( room[curRoom], gifCaptureCtx, 0 );
	var frame0 = gifCaptureCtx.getImageData(0,0,512,512);

	drawRoom( room[curRoom], gifCaptureCtx, 1 );
	var frame1 = gifCaptureCtx.getImageData(0,0,512,512);

	if (isGifSnapshotLandscape) {
		/* widescreen */
		gif.width = gifCaptureWidescreenSize.width;
		gif.height = gifCaptureWidescreenSize.height;
		gifCaptureCanvas.width = gifCaptureWidescreenSize.width;
		gifCaptureCanvas.height = gifCaptureWidescreenSize.height;

		var widescreenX = (gifCaptureWidescreenSize.width / 2) - (512 / 2);
		var widescreenY = (gifCaptureWidescreenSize.height / 2) - (512 / 2);

		gifCaptureCtx.fillStyle = "rgb(" + getPal(curPal())[0][0] + "," + getPal(curPal())[0][1] + "," + getPal(curPal())[0][2] + ")";
		gifCaptureCtx.fillRect(0,0,gifCaptureWidescreenSize.width,gifCaptureWidescreenSize.height);

		gifCaptureCtx.putImageData(frame0,widescreenX,widescreenY);
		frame0 = gifCaptureCtx.getImageData(0,0,gifCaptureWidescreenSize.width,gifCaptureWidescreenSize.height);

		gifCaptureCtx.putImageData(frame1,widescreenX,widescreenY);
		frame1 = gifCaptureCtx.getImageData(0,0,gifCaptureWidescreenSize.width,gifCaptureWidescreenSize.height);
	}

	gif.frames.push( frame0.data );
	gif.frames.push( frame1.data );

	finishRecordingGif(gif);
}

function stopRecordingGif() {
	var gif = {
		frames: gifFrameData,
		width: 512,
		height: 512,
		loops: 0,
		delay: 10
	};

	finishRecordingGif(gif);
}

// TODO - palette for rainbow text
function finishRecordingGif(gif) {
	if(gifRecordingInterval != null) {
		clearInterval( gifRecordingInterval );
		gifRecordingInterval = null;
	}

	document.getElementById("gifStartButton").style.display="none";
	document.getElementById("gifSnapshotButton").style.display="none";
	document.getElementById("gifSnapshotModeButton").style.display="none";
	document.getElementById("gifStopButton").style.display="none";
	document.getElementById("gifRecordingText").style.display="none";
	document.getElementById("gifEncodingText").style.display="inline";
	document.getElementById("gifEncodingProgress").innerText = "0";

	if(gif.frames.length <= 0) {
		document.getElementById("gifEncodingText").style.display="none";
		document.getElementById("gifStartButton").style.display="inline";
		return; // nothing recorded, nothing to encode
	}

	setTimeout( function() {
		var hexPalette = [];

		// add black & white
		hexPalette.push( rgbToHex(0,0,0).slice(1) ); // need to slice off leading # (should that safeguard go in gif.js?)
		hexPalette.push( rgbToHex(255,255,255).slice(1) );

		// add rainbow colors (for rainbow text effect)
		hexPalette.push( hslToHex(0.0,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.1,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.2,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.3,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.4,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.5,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.6,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.7,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.8,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.9,1,0.5).slice(1) );

		// add all user defined palette colors
		for (id in palette) {
			for (i in getPal(id)){
				var hexStr = rgbToHex( getPal(id)[i][0], getPal(id)[i][1], getPal(id)[i][2] ).slice(1);

				// gif palettes max out at 256 colors
				// this avoids totally breaking the gif if a game has more colors than that
				// TODO : make this smarter by keeping track palettes of visited rooms
				if (hexPalette.length < 256) {
					hexPalette.push( hexStr );
				}
			}
		}

		gif.palette = hexPalette; // hacky

		gifencoder.encode( gif, 
			function(uri, blob) {
				document.getElementById("gifEncodingText").style.display="none";
				document.getElementById("gifStartButton").style.display="inline";
				document.getElementById("gifPreview").src = uri;
				document.getElementById("gifPreview").style.display="block";
				document.getElementById("gifPlaceholder").style.display="none";
				document.getElementById("gifSnapshotButton").style.display="inline";
				document.getElementById("gifSnapshotModeButton").style.display="inline";

				if( browserFeatures.blobURL ) {
					document.getElementById("gifDownload").href = makeURL.createObjectURL( blob );
				}
				else {
					var downloadData = uri.replace("data:;", "data:attachment/file;"); // for safari
					document.getElementById("gifDownload").href = downloadData;
				}
			},
			function(curFrame, maxFrame) {
				document.getElementById("gifEncodingProgress").innerText = Math.floor( (curFrame / maxFrame) * 100 );
			}
		);
	}, 10);
}

/* LOAD FROM FILE */
function importGameFromFile(e) {
	if (isPlayMode) {
		alert("You can't upload a game while you're playing one! Sorry :(");
		return;
	}

	resetGameData();

	// load file chosen by user
	var files = e.target.files;
	var file = files[0];
	var reader = new FileReader();
	reader.readAsText( file );

	reader.onloadend = function() {
		var fileText = reader.result;
        gameDataStr = exporter.importGame(fileText);

		// change game data & reload everything
        document.getElementById("game_data").value = gameDataStr;
		on_game_data_change();

		paintExplorer.Refresh(drawing.type);
	}
}

function importFontFromFile(e) {
	// load file chosen by user
	var files = e.target.files;
	var file = files[0];
	var reader = new FileReader();
	reader.readAsText( file );

	reader.onloadend = function() {
		var fileText = reader.result;
		console.log(fileText);

		var customFontName = (fontManager.Create(fileText)).getName();

		fontManager.AddResource(customFontName + fontManager.GetExtension(), fileText);
		switchFont(customFontName); // bitsy engine setting

		var fontStorage = {
			name : customFontName,
			fontdata : fileText
		};
        localStorage.bitsy_color_custom_font = JSON.stringify(fontStorage);

		refreshGameData();
		updateFontSelectUI();

		// TODO
		// fontLoadSettings.resources.set("custom.txt", fileText); // hacky!!!
	}
}

/* ANIMATION EDITING*/
function on_toggle_animated() {
	console.log("ON TOGGLE ANIMATED");
	console.log(document.getElementById("animatedCheckbox").checked);
	console.log(drawing.type);
	console.log("~~~~~");
	if ( document.getElementById("animatedCheckbox").checked ) {
		if ( drawing.type === TileType.Sprite || drawing.type === TileType.Avatar ) {
			addSpriteAnimation();
		}
		else if ( drawing.type === TileType.Tile ) {
			addTileAnimation();
		}
		else if ( drawing.type === TileType.Item ) {
			addItemAnimation();
		}
		document.getElementById("animation").setAttribute("style","display:block;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_more");
		console.log(drawing.id);
		renderAnimationPreview( drawing.id );
	}
	else {
		if ( drawing.type === TileType.Sprite || drawing.type === TileType.Avatar ) {
			removeSpriteAnimation();
		}
		else if ( drawing.type === TileType.Tile ) {
			removeTileAnimation();			
		}
		else if ( drawing.type === TileType.Item ) {
			console.log("REMOVE ITEM ANIMATION");
			removeItemAnimation();
		}
		document.getElementById("animation").setAttribute("style","display:none;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_less");
	}
	renderPaintThumbnail( drawing.id );
}

function addSpriteAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = true;
	paintTool.curDrawingFrameIndex = 0;

	//mark sprite as animated
	sprite[drawing.id].animation.isAnimated = true;
	sprite[drawing.id].animation.frameIndex = 0;
	sprite[drawing.id].animation.frameCount = 2;

	//add blank frame to sprite (or restore removed animation)
	var spriteImageId = "SPR_" + drawing.id;
	if (sprite[drawing.id].cachedAnimation != null) {
		restoreDrawingAnimation( spriteImageId, sprite[drawing.id].cachedAnimation )
	}
	else {
		addNewFrameToDrawing( spriteImageId );
	}

	// TODO RENDERER : refresh images

	//refresh data model
	refreshGameData();
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

function removeSpriteAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = false;

	//mark sprite as non-animated
	sprite[drawing.id].animation.isAnimated = false;
	sprite[drawing.id].animation.frameIndex = 0;
	sprite[drawing.id].animation.frameCount = 0;

	//remove all but the first frame of the sprite
	var spriteImageId = "SPR_" + drawing.id;
	cacheDrawingAnimation( sprite[drawing.id], spriteImageId );
	removeDrawingAnimation( spriteImageId );

	// TODO RENDERER : refresh images

	//refresh data model
	refreshGameData();
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

function addTileAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = true;
	paintTool.curDrawingFrameIndex = 0;

	//mark tile as animated
	tile[drawing.id].animation.isAnimated = true;
	tile[drawing.id].animation.frameIndex = 0;
	tile[drawing.id].animation.frameCount = 2;

	//add blank frame to tile (or restore removed animation)
	var tileImageId = "TIL_" + drawing.id;
	if (tile[drawing.id].cachedAnimation != null) {
		restoreDrawingAnimation( tileImageId, tile[drawing.id].cachedAnimation )
	}
	else {
		addNewFrameToDrawing( tileImageId );
	}

	// TODO RENDERER : refresh images

	//refresh data model
	refreshGameData();
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

function removeTileAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = false;

	//mark tile as non-animated
	tile[drawing.id].animation.isAnimated = false;
	tile[drawing.id].animation.frameIndex = 0;
	tile[drawing.id].animation.frameCount = 0;

	//remove all but the first frame of the tile
	var tileImageId = "TIL_" + drawing.id;
	cacheDrawingAnimation( tile[drawing.id], tileImageId );
	removeDrawingAnimation( tileImageId );

	// TODO RENDERER : refresh images

	//refresh data model
	refreshGameData();
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

// TODO : so much duplication it makes me sad :(
function addItemAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = true;
	paintTool.curDrawingFrameIndex = 0;

	//mark item as animated
	item[drawing.id].animation.isAnimated = true;
	item[drawing.id].animation.frameIndex = 0;
	item[drawing.id].animation.frameCount = 2;

	//add blank frame to item (or restore removed animation)
	var itemImageId = "ITM_" + drawing.id;
	if (item[drawing.id].cachedAnimation != null) {
		restoreDrawingAnimation( itemImageId, item[drawing.id].cachedAnimation )
	}
	else {
		addNewFrameToDrawing( itemImageId );
	}

	// TODO RENDERER : refresh images

	//refresh data model
	refreshGameData();
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

function removeItemAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = false;

	//mark item as non-animated
	item[drawing.id].animation.isAnimated = false;
	item[drawing.id].animation.frameIndex = 0;
	item[drawing.id].animation.frameCount = 0;

	//remove all but the first frame of the item
	var itemImageId = "ITM_" + drawing.id;
	cacheDrawingAnimation( item[drawing.id], itemImageId );
	removeDrawingAnimation( itemImageId );

	// TODO RENDERER : refresh images

	//refresh data model (TODO : these should really be a shared method)
	refreshGameData();
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

function addNewFrameToDrawing(drwId) {
	// copy first frame data into new frame
	var imageSource = renderer.GetImageSource(drwId);
	var firstFrame = imageSource[0];
	var newFrame = [];
	var tilesize = firstFrame.length;
	for (var y = 0; y < tilesize; y++) {
		newFrame.push([]);
		for (var x = 0; x < tilesize; x++) {
			newFrame[y].push( firstFrame[y][x] );
		}
	}
	imageSource.push( newFrame );
	renderer.SetImageSource(drwId, imageSource);
}

function removeDrawingAnimation(drwId) {
	var imageSource = renderer.GetImageSource(drwId);
	var oldImageData = imageSource.slice(0);
	renderer.SetImageSource( drwId, [ oldImageData[0] ] );
}

// let's us restore the animation during the session if the user wants it back
function cacheDrawingAnimation(drawing,sourceId) {
	var imageSource = renderer.GetImageSource(sourceId);
	var oldImageData = imageSource.slice(0);
	drawing.cachedAnimation = [ oldImageData[1] ]; // ah the joys of javascript
}

function restoreDrawingAnimation(sourceId,cachedAnimation) {
	var imageSource = renderer.GetImageSource(sourceId);
	for (f in cachedAnimation) {
		imageSource.push( cachedAnimation[f] );	
	}
	renderer.SetImageSource(sourceId, imageSource);
}

function on_paint_frame1() {
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

function on_paint_frame2() {
	paintTool.curDrawingFrameIndex = 1;
	paintTool.reloadDrawing();
}

var export_settings = {
	page_color : "#ffffff"
};

function on_change_color_page() {
	var hex = document.getElementById("pageColor").value;
	//console.log(hex);
	var rgb = hexToRgb( hex );
	// document.body.style.background = hex;
	document.getElementById("roomPanel").style.background = hex;
	export_settings.page_color = hex;

	localStorage.bitsy_color_export_settings = JSON.stringify( export_settings );
}

function getComplimentingColor(palId) {
	if (!palId) palId = curPal();
	var hsl = rgbToHsl( getPal(palId)[0][0], getPal(palId)[0][1], getPal(palId)[0][2] );
	// console.log(hsl);
	var lightness = hsl[2];
	if (lightness > 0.5) {
		return "#fff";
	}
	else {
		return "#000";
	}
}

/* MOVEABLE PANESL */
var grabbedPanel = {
	card: null,
	size: 0,
	cursorOffset: {x:0,y:0},
	shadow: null
};

function grabCard(e) {
	// can't grab cards in vertical mode right now
	if (window.innerHeight > window.innerWidth) { // TODO : change to portrait orientation check??
		return;
	}

	// e.preventDefault();

	console.log("--- GRAB START");
	console.log(grabbedPanel.card);

	if (grabbedPanel.card != null) return;

	grabbedPanel.card = e.target;
	while(!grabbedPanel.card.classList.contains("panel") && !(grabbedPanel.card == null)) {
		grabbedPanel.card = grabbedPanel.card.parentElement;
	}

	if(grabbedPanel.card == null) return; // couldn't find a panel above the handle - abort!

	console.log(grabbedPanel.card);
	console.log("--")

	grabbedPanel.size = getElementSize( grabbedPanel.card );
	var pos = getElementPosition( grabbedPanel.card );
	
	grabbedPanel.shadow = document.createElement("div");
	grabbedPanel.shadow.className = "panelShadow";
	grabbedPanel.shadow.style.width = grabbedPanel.size.x + "px";
	grabbedPanel.shadow.style.height = grabbedPanel.size.y + "px";

	console.log( document.getElementById("editorContent") );
	console.log( grabbedPanel.shadow );
	console.log( grabbedPanel.card );

	document.getElementById("editorContent").insertBefore( grabbedPanel.shadow, grabbedPanel.card );
	grabbedPanel.cursorOffset.x = e.clientX - pos.x;
	grabbedPanel.cursorOffset.y = e.clientY - pos.y;
	console.log("client " + e.clientX);
	console.log("card " + pos.x);
	console.log("offset " + grabbedPanel.cursorOffset.x);
	// console.log("screen " + e.screenX);
	grabbedPanel.card.style.position = "absolute";
	grabbedPanel.card.style.left = e.clientX - grabbedPanel.cursorOffset.x + "px";
	grabbedPanel.card.style.top = e.clientY - grabbedPanel.cursorOffset.y + "px";
	grabbedPanel.card.style.zIndex = 1000;
}

function panel_onMouseMove(e) {
	if (grabbedPanel.card == null) return;

	console.log("-- PANEL MOVE");
	console.log(grabbedPanel.card);

	grabbedPanel.card.style.left = e.clientX - grabbedPanel.cursorOffset.x + "px";
	grabbedPanel.card.style.top = e.clientY - grabbedPanel.cursorOffset.y + "px";

	var cardPos = getElementPosition( grabbedPanel.card );
	var cardSize = grabbedPanel.size;
	var cardCenter = { x:cardPos.x+cardSize.x/2, y:cardPos.y+cardSize.y/2 };

	console.log(cardCenter);

	var editorContent = document.getElementById("editorContent");
	var editorContentWidth = editorContent.getBoundingClientRect().width;
	var otherCards = editorContent.getElementsByClassName("panel");

	// var cardCollection = editorContent.getElementsByClassName("panel");
	// var otherCards = [];
	// for (var i = 0; i < cardCollection.length; i++) {
	// 	otherCards.push(cardCollection[i]);
	// }
	// // console.log(otherCards);

	// // hacky fix for arabic -- need better solution
	// if (curEditorLanguageCode === "ar") {
	// 	// otherCards.reverse();
	// 	cardCenter.x = editorContentWidth - cardCenter.x;
	// }

	// console.log(cardCenter);
	// console.log("---");

	for(var j = 0; j < otherCards.length; j++) {
		var other = otherCards[j];
		// console.log(other);
		var otherPos = getElementPosition( other );
		var otherSize = getElementSize( other );
		var otherCenter = { x:otherPos.x+otherSize.x/2, y:otherPos.y+otherSize.y/2 };

		// console.log(otherCenter);

		if ( cardCenter.x < otherCenter.x ) {
			console.log("INSERT " + cardCenter.x + " " + otherCenter.x);
			console.log(other);

			editorContent.insertBefore( grabbedPanel.shadow, other );
			break;
		}
		else if (j == otherCards.length - 1 && cardCenter.x > otherCenter.x) {
			editorContent.appendChild( grabbedPanel.shadow );
			break;
		}
	}

	console.log("********")
}
document.addEventListener("mousemove",panel_onMouseMove);

function panel_onMouseUp(e) {
	if (grabbedPanel.card == null) return;

	var editorContent = document.getElementById("editorContent");
	editorContent.insertBefore( grabbedPanel.card, grabbedPanel.shadow );
	editorContent.removeChild( grabbedPanel.shadow );
	grabbedPanel.card.style.position = "relative";
	grabbedPanel.card.style.top = null;
	grabbedPanel.card.style.left = null;
	grabbedPanel.card.style.zIndex = null;

	// drop card anim
	var cardTmp = grabbedPanel.card;
	cardTmp.classList.add("drop");
	setTimeout( function() { cardTmp.classList.remove("drop"); }, 300 );

	grabbedPanel.card = null;

	updatePanelPrefs();
}
document.addEventListener("mouseup",panel_onMouseUp);

// TODO consolidate these into one function?
function getElementPosition(e) { /* gets absolute position on page */
	if (!e.getBoundingClientRect) {
		console.log("NOOO BOUNDING RECT!!!");
		return {x:0,y:0};
	}

	var rect = e.getBoundingClientRect();
	var pos = {x:rect.left,y:rect.top};
	// console.log(pos);
	return pos;
}

function getElementSize(e) { /* gets visible size */
	return {
		x: e.clientWidth,
		y: e.clientHeight
	};
}

// sort of a hack to avoid accidentally activating backpage and nextpage while scrolling through editor panels 
function blockScrollBackpage(e) {
	var el = document.getElementById("editorWindow");
	var maxX = el.scrollWidth - el.offsetWidth;

	// if ( el.scrollLeft + e.deltaX < 0 || el.scrollLeft + e.deltaX > maxX )
	// {
	// 	e.preventDefault();
	// 	el.scrollLeft = Math.max(0, Math.min(maxX, el.scrollLeft + event.deltaX));
	// }
}


function toggleDialogCode(e) {
	var showCode = e.target.checked;

	// toggle button text
	document.getElementById("dialogToggleCodeShowText").style.display = showCode ? "none" : "inline";
	document.getElementById("dialogToggleCodeHideText").style.display = showCode ? "inline" : "none";

	// update editor
	var dialogEditorViewport = document.getElementById("dialogEditor");
	dialogEditorViewport.innerHTML = "";
	if (showCode) {
		dialogEditorViewport.appendChild(curPlaintextDialogEditor.GetElement());
	}
	else {
		dialogEditorViewport.appendChild(curDialogEditor.GetElement());
	}
}

var alwaysShowDrawingDialog = true;
function toggleAlwaysShowDrawingDialog(e) {
	alwaysShowDrawingDialog = e.target.checked;

	if (alwaysShowDrawingDialog) {
		var dlg = getCurDialogId();
		if (dialog[dlg]) {
			openDialogTool(dlg);
		}
	}
}

function showInventoryItem() {
	document.getElementById("inventoryItem").style.display = "block";
	document.getElementById("inventoryVariable").style.display = "none";
}

function showInventoryVariable() {
	document.getElementById("inventoryItem").style.display = "none";
	document.getElementById("inventoryVariable").style.display = "block";
}

var isPreviewDialogMode = false;
function togglePreviewDialog(event) {
	if (event.target.checked) {
		if (curDialogEditor != null) {
			isPreviewDialogMode = true;

			if (document.getElementById("roomPanel").style.display === "none") {
				showPanel("roomPanel");
			}

			on_play_mode();
		
			startPreviewDialog(
				curDialogEditor.GetNode(), 
				function() {
					togglePreviewDialog({ target : { checked : false } });
				});
		}
	}
	else {
		on_edit_mode();
		isPreviewDialogMode = false;
	}

	updatePlayModeButton();
	updatePreviewDialogButton();
}

var isFixedSize = false;
function chooseExportSizeFull() {
	isFixedSize = false;
	document.getElementById("exportSizeFixedInputSpan").style.display = "none";
}

function chooseExportSizeFixed() {
	isFixedSize = true;
	document.getElementById("exportSizeFixedInputSpan").style.display = "inline-block";
}

// LOCALIZATION
var localization;
function on_change_language(e) {
	var language = e.target.value;
	pickDefaultFontForLanguage(language);
	on_change_language_inner(language);
}

function on_change_language_inner(language) {
	changeLnaguageStyle(language); // TODO : misspelled funciton name

	localization.ChangeLanguage(language);
	updateInventoryUI();
	reloadDialogUI();
	hackyUpdatePlaceholderText();

	// update title in new language IF the user hasn't made any changes to the default title
	if (localization.LocalizationContains("default_title", getTitle())) {
		setTitle(localization.GetStringOrFallback("default_title", "Write your game's title here"));
		// make sure all editors with a title know to update
		events.Raise("dialog_update", { dialogId:titleDialogId, editorId:null });
	}

	// update default sprite
	var defaultSpriteDlgExists = dialog["0"] != null && localization.LocalizationContains("default_sprite_dlg", dialog["0"]);
	if (defaultSpriteDlgExists) {
		dialog["0"] = {
			src: localization.GetStringOrFallback("default_sprite_dlg", "I'm a cat"),
			name: null,
		};
		paintTool.reloadDrawing();
	}

	// update default item
	var defaultItemDlgExists = dialog["1"] != null && localization.LocalizationContains("default_item_dlg", dialog["1"]);
	if (defaultItemDlgExists) {
		dialog["1"] = {
			src: localization.GetStringOrFallback("default_item_dlg", "You found a nice warm cup of tea"),
			name: null,
		};
		paintTool.reloadDrawing(); // hacky to do this twice
	}

	refreshGameData();
}

// TODO : create a system for placeholder text like I have for innerText
function hackyUpdatePlaceholderText() {
	var titlePlaceholder = localization.GetStringOrFallback("title_placeholder", "Title");
	var titleTextBoxes = document.getElementsByClassName("titleTextBox");
	for (var i = 0; i < titleTextBoxes.length; i++) {
		titleTextBoxes[i].placeholder = titlePlaceholder;
	}

	var filterPlaceholder = localization.GetStringOrFallback("filter_placeholder", "filter drawings");
	document.getElementById("paintExplorerFilterInput").placeholder = filterPlaceholder;
}

var curEditorLanguageCode = "en";
function changeLnaguageStyle(newCode) { // TODO : fix function name
	document.body.classList.remove("lang_" + curEditorLanguageCode);
	curEditorLanguageCode = newCode;
	document.body.classList.add("lang_" + curEditorLanguageCode);
}

function pickDefaultFontForLanguage(lang) {
	// TODO : switch to asian characters when we get asian language translations of editor
	if (lang === "en") {
		switchFont("ascii_small", true /*doPickTextDirection*/);
	}
	else if (lang === "ar") {
		switchFont("arabic", true /*doPickTextDirection*/);
	}
	else if (lang === "zh" || lang === "ja") {
		switchFont("unicode_asian", true /*doPickTextDirection*/);
	}
	else {
		switchFont("unicode_european_small", true /*doPickTextDirection*/);
	}
	updateFontSelectUI();
	resetMissingCharacterWarning();
}

function on_change_font(e) {
	if (e.target.value != "custom") {
		switchFont(e.target.value, true /*doPickTextDirection*/);
	}
	else {
        if (localStorage.bitsy_color_custom_font != null) {
            var fontStorage = JSON.parse(localStorage.bitsy_color_custom_font);
			switchFont(fontStorage.name, true /*doPickTextDirection*/);
		}
		else {
			// fallback
			switchFont("ascii_small", true /*doPickTextDirection*/);
		}
	}
	updateFontDescriptionUI();
	// updateEditorTextDirection();
	resetMissingCharacterWarning();
}

function switchFont(newFontName, doPickTextDirection) {
	if (doPickTextDirection === undefined || doPickTextDirection === null) {
		doPickTextDirection = false;
	}

	fontName = newFontName;

	if (doPickTextDirection) {
		console.log("PICK TEXT DIR");
		pickDefaultTextDirectionForFont(newFontName);
	}

	refreshGameData()
}

function initLanguageOptions() {
	localization.Localize();

	var languageSelect = document.getElementById("languageSelect");
	languageSelect.innerHTML = "";

	var languageList = localization.GetLanguageList();
	for (var i = 0; i < languageList.length; i++) {
		var option = document.createElement("option");
		option.innerText = languageList[i].name;
		option.value = languageList[i].id;
		option.selected = languageList[i].id === localization.GetLanguage();
		languageSelect.add(option);
	}

	// is this doing duplicate work??
	on_change_language_inner( localization.GetLanguage() );
}

function on_change_text_direction(e) {
	console.log("CHANGE TEXT DIR " + e.target.value);
	updateEditorTextDirection(e.target.value);
	refreshGameData();
}

function pickDefaultTextDirectionForFont(newFontName) {
	var newTextDirection = TextDirection.LeftToRight;
	if (newFontName === "arabic") {
		newTextDirection = TextDirection.RightToLeft;
	}
	updateEditorTextDirection(newTextDirection);
	updateTextDirectionSelectUI();
}

function updateEditorTextDirection(newTextDirection) {
	var prevTextDirection = textDirection;
	textDirection = newTextDirection;

	console.log("TEXT BOX TEXT DIR " + textDirection);

	if (prevTextDirection != null) {
		document.body.classList.remove("dir_" + prevTextDirection.toLowerCase());
	}
	document.body.classList.add("dir_" + textDirection.toLowerCase());
}

function updateTextDirectionSelectUI() {
	var textDirSelect = document.getElementById("textDirectionSelect");
	for (var i in textDirSelect.options) {
		var option = textDirSelect.options[i];
		option.selected = (option.value === textDirection);
	}
}

/* UTILS (todo : move into utils.js after merge) */
function CreateDefaultName(defaultNamePrefix, objectStore, ignoreNumberIfFirstName) {
	if (ignoreNumberIfFirstName === undefined || ignoreNumberIfFirstName === null) {
		ignoreNumberIfFirstName = false;
	}

	var nameCount = ignoreNumberIfFirstName ? -1 : 0; // hacky :(
	for (id in objectStore) {
		if (objectStore[id].name) {
			if (objectStore[id].name.indexOf(defaultNamePrefix) === 0) {
				var nameCountStr = objectStore[id].name.slice(defaultNamePrefix.length);

				var nameCountInt = 0;
				if (nameCountStr.length > 0) {
					nameCountInt = parseInt(nameCountStr);
				}

				if (!isNaN(nameCountInt) && nameCountInt > nameCount) {
					nameCount = nameCountInt;
				}
			}
		}
	}

	if (ignoreNumberIfFirstName && nameCount < 0) {
		return defaultNamePrefix;
	}

	return defaultNamePrefix + " " + (nameCount + 1);
}

/* DOCS */
function toggleDialogDocs(e) {
	console.log("SHOW DOCS");
	console.log(e.target.checked);
	if (e.target.checked) {
		document.getElementById("dialogDocs").style.display = "block";
		document.getElementById("dialogToggleDocsShowText").style.display = "none";
		document.getElementById("dialogToggleDocsHideText").style.display = "inline";
	}
	else {
		document.getElementById("dialogDocs").style.display = "none";
		document.getElementById("dialogToggleDocsShowText").style.display = "inline";
		document.getElementById("dialogToggleDocsHideText").style.display = "none";
	}
}

/* WARNINGS */
// TODO : turn this into a real system someday instead of hard-coded nonsense
var missingCharacterWarningState = {
	showedWarning : false,
	curFont : null
}

function resetMissingCharacterWarning() {
	// missingCharacterWarningState.showedWarning = false; // should I really do this every time?
	missingCharacterWarningState.curFont = fontManager.Get( fontName );
}

function tryWarnAboutMissingCharacters(text) {
	if (missingCharacterWarningState.showedWarning) {
		return;
	}

	var hasMissingCharacter = false;

	console.log(missingCharacterWarningState.curFont.getData());

	for (var i = 0; i < text.length; i++) {
		var character = text[i];
		if (!missingCharacterWarningState.curFont.hasChar(character)) {
			hasMissingCharacter = true;
		}
	}

	if (hasMissingCharacter) {
		showFontMissingCharacterWarning();
	}
}

function showFontMissingCharacterWarning() {
	document.getElementById("fontMissingCharacter").style.display = "block";
	missingCharacterWarningState.showedWarning = true;
}

function hideFontMissingCharacterWarning() {
	document.getElementById("fontMissingCharacter").style.display = "none";
}

/* ICONS */
var iconUtils = new IconUtils(); // TODO : move?
