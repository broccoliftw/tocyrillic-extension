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

// since we heaven't access to localStorage, we'll get it by message passing
chrome.extension.sendRequest({"action": "getProperties"}, function(response) {
	if(response["tocyrillic.button"] && KEY_CODES[response["tocyrillic.button"]]){
		toggleKeyCode = KEY_CODES[response["tocyrillic.button"]];
	}
});

// functions
function print_obj(o){
	for(var k in o){
		console.log(k + " = " + o[k]);
	}
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
	if(!isTextElement(input)) return;
	var keyCode = e.keyCode;
	var toggleMode = input.getAttribute(TOGGLE_MODE_ATTR) == 'true';
	// toggle mode
	if(keyCode == toggleKeyCode){
		if(toggleMode){
			input.setAttribute(TOGGLE_MODE_ATTR, 'false');
			// restore style border
			input.style.border = input.getAttribute(PREV_BORDER_ATTR);
		}
		else{
			input.setAttribute(TOGGLE_MODE_ATTR, 'true');
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
	var toggleMode = input.getAttribute(TOGGLE_MODE_ATTR) == 'true';
	var txt = getElementValue(input);
	if(toggleMode && input.previous_value != txt){
		toCyrillic(input);
		input.previous_value = getElementValue(input);
	}
}
// element value wrappers
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

