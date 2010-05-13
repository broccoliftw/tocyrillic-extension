//setup
var KEY_CODES = {
  "F2" : 113,
  "F3" : 114,
  "F4" : 115,
  "F5" : 116,
  "F6" : 117,
  "F7" : 118,
  "F8" : 120,
  "F9" : 121,
  "F10" : 122,
};

var toggleKeyCode = KEY_CODES["F2"];
var globalToggleEnabled = false;
var globalToggleMode = false;
// set globals from properties
function acceptProperties(properties){
	if(properties["tocyrillic.button"] && KEY_CODES[properties["tocyrillic.button"]]){
		toggleKeyCode = KEY_CODES[properties["tocyrillic.button"]];
	}
	globalToggleEnabled = properties["tocyrillic.global"] == "true";
	globalToggleMode = properties["tocyrillic.global.mode"] == "true";
}
// since we heaven't access to localStorage, we'll get properties by message passing
chrome.extension.sendRequest({"action": "getProperties"}, function(response) { 
	acceptProperties(response);
	if(globalToggleEnabled && globalToggleMode){
		showMessage("Global cyrillic mode enabled");
	}
});
// listen for setProperties
chrome.extension.onRequest.addListener(	function(request, sender, sendResponse) {
	if(request.action == "setProperties"){
		acceptProperties(request);
	}
});

// functions
function obj2str(o){
	var res = '';
	for(var k in o){
		res += k + " = " + o[k] + "\n";
	}
	return res;
}
function print_obj(o){
	for(var k in o){
		console.log(k + " = " + o[k]);
	}
}
// show message
var messageElement;
var messageHideTimer;
function showMessage(message){
	if(!messageElement){
		messageElement = document.createElement('DIV');
		messageElement.style.font = '12px arial,sans-serif';
		messageElement.style.padding = '2px';
		messageElement.style.color = '#444';
		messageElement.style.backgroundColor = '#9e9';
		messageElement.style.border = '1px solid '+messageElement.style.color;
		messageElement.style.position = 'fixed';
		messageElement.style.top = '1px';
		messageElement.style.right = '1px';
		document.body.appendChild(messageElement);
	}
	else{
		messageElement.style.display = '';
	}
	messageElement.innerHTML = message;
	if(messageHideTimer){
		clearTimeout(messageHideTimer);
	}
	messageHideTimer = setTimeout(function() {messageElement.style.display = 'none';}, 1500);
}
// main function for translit -> cyrillic convert
function toCyrillic(input){
	var doc = input.ownerDocument;
	var isRich = isRichTextElement(input);
	var cursorPos = 0;
	if(isRich){// rich text operates with selection and range objects
		var selection = doc.getSelection();
		var selectionNode = selection.anchorNode;
		cursorPos = selection.anchorOffset;
		txt = selectionNode.nodeValue;
	}
	else{
	    cursorPos = input.selectionEnd;
	    txt = getElementValue(input);
	}
	if(cursorPos == 0) return;

	var pos = cursorPos-1;
	var chr = txt.charAt(pos);
	var offset = 0;
	var cyr = '';
	if(pos > 0){
		var prevLat = CYR[txt.charAt(pos-1)];
		if(prevLat){
			var cyr = LAT[prevLat+chr];
			if(cyr) offset = 1;
		}
	}
	if(!cyr) cyr = LAT[chr];
	if(cyr){
		var newTxt = txt.substr(0, pos - offset) + cyr + txt.substr(pos + 1);
		var newCursorPos = cursorPos - offset;
		if(isRich){
			selectionNode.nodeValue = newTxt;
			if(offset > 0){// set new caret position
				if(isRich){// in rich text we'll create new range 
					var newRange = doc.createRange();
					newRange.setStart(selectionNode, newCursorPos);
					newRange.setEnd(selectionNode, newCursorPos);
					selection.removeAllRanges();
					selection.addRange(newRange);
				}
			}
		}
		else{
			input.value = newTxt;
			input.selectionEnd = newCursorPos;
		}
		
	}
}

var TOGGLE_MODE_ATTR = 'tocirillic_toggle_mode';
var PREV_BORDER_ATTR = 'tocirillic_prev_border';
var REGISTRED_ATTR = 'tocyrillic_registered';
// listener functions
function keyDownListener(e){
	var input = e.target;
	var keyCode = e.keyCode;
	// support for global toggle mode
	if(globalToggleEnabled && keyCode == toggleKeyCode){
		globalToggleMode = !globalToggleMode;
		// propagate global toggle mode to all
		chrome.extension.sendRequest({"action": "propagateGlobalToggleMode", "tocyrillic.global.mode": globalToggleMode}, function(r){});
		showMessage("Global cyrillic mode " + (globalToggleMode?'enabled':'disabled'));
		return;
	}
	if(!isTextElement(input)) return;
	var toggleMode = isCyrillicEnabledForElement(input);
	// toggle mode
	if(keyCode == toggleKeyCode){
		if(toggleMode){
			setCyrillicEnabledForElement(input, false);
			// restore style border
			input.style.border = input.getAttribute(PREV_BORDER_ATTR);
		}
		else{
			setCyrillicEnabledForElement(input, true);
			// store style border
			input.setAttribute(PREV_BORDER_ATTR, input.style.border);
			input.style.border = '2px #d77 dotted';
		}
		// prevents key up listener 
		input.previous_value = getElementValue(input);
	}
	else if(toggleMode && input.previous_value != input.value){
		keyUpListener(e);
	}
}
function keyUpListener(e){
	var input = e.target;
	// skip non-text elements
	if(!isTextElement(input)) return;
	// skip backspace, delete etc.
	if(e.keyCode < 48) return;
	var toggleMode = isCyrillicEnabledForElement(input);
	var txt = getElementValue(input);
	if(toggleMode && input.previous_value != txt){
		toCyrillic(input);
		input.previous_value = getElementValue(input);
	}
}
// element value wrappers
function isCyrillicEnabledForElement(el){
	if(globalToggleEnabled){
		return globalToggleMode;
	}
	else{
		return el.getAttribute(TOGGLE_MODE_ATTR) == 'true';
	}
}
function setCyrillicEnabledForElement(el, enabled){
	el.setAttribute(TOGGLE_MODE_ATTR, enabled?'true':'false');
}
function getElementValue(el){
	if(isRichTextElement(el)) return el.innerHTML;
	else return el.value;
}
function setElementValue(el, value){
	if(isRichTextElement(el)) el.innerHTML = value;
	else el.value = value;
}
//check if el is text element
function isTextElement(el){
	if((el.tagName == 'INPUT' && (el.type == null || el.type == 'text')) ||
		el.tagName == 'TEXTAREA' ||
	    isRichTextElement(el)){
		return true;
	}
	return false;
}
// check if element is rich text element (usually html or body inside iframe in design mode)
function isRichTextElement(el){
	return el.isContentEditable;
}
//global events registration
function registerGlobalListeners(doc){
	// save registration status on html element
	// to avoid double listeners
	var html = doc.getElementsByTagName('html')[0];
	if(!html.getAttribute(REGISTRED_ATTR)){
		console.log("document global listeners registered");
		html.setAttribute(REGISTRED_ATTR, 'true');
		doc.addEventListener("keydown", keyDownListener, true);
		doc.addEventListener("keyup", keyUpListener, true);
	}
}
// registration of iframes
function registerIFrames(){
	var iframes = document.getElementsByTagName('iframe');
	for(var i=0; i<iframes.length; i++){
		var iframe = iframes[i];
		// register each iframe once
		if(!iframe.getAttribute(REGISTRED_ATTR)){
			console.log("iframe global listeners registered " + iframe.location);
			iframe.setAttribute(REGISTRED_ATTR, 'true');
			registerGlobalListeners(iframe.contentDocument);
		}
	}
}

console.log("tocyrillic started");
registerGlobalListeners(document);
// TODO replace timer by on create event if possible
setTimeout(function(){setInterval(registerIFrames, 2000);}, 2000);
