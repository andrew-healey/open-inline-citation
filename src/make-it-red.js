// if (Zotero.platformMajorVersion < 102) {
// 	Cu.importGlobalProperties(['URL']);
// }

// MakeItRed = {
// 	id: null,
// 	version: null,
// 	rootURI: null,
// 	initialized: false,
// 	addedElementIDs: [],
	
// 	init({ id, version, rootURI }) {
// 		return;
// 		if (this.initialized) return;
// 		this.id = id;
// 		this.version = version;
// 		this.rootURI = rootURI;
// 		this.initialized = true;
// 	},
	
// 	log(msg) {
// 		return;
// 		Zotero.debug("Open Inline Citation: " + msg);
// 	},
	
// 	addToWindow(window) {
// 		return;
// 		let doc = window.document;
		
// 		// createElementNS() necessary in Zotero 6; createElement() defaults to HTML in Zotero 7
// 		let HTML_NS = "http://www.w3.org/1999/xhtml";
// 		let XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
		
// 		// Add a stylesheet to the main Zotero pane
// 		let link1 = doc.createElementNS(HTML_NS, 'link');
// 		link1.id = 'open-inline-citation-stylesheet';
// 		link1.type = 'text/css';
// 		link1.rel = 'stylesheet';
// 		link1.href = this.rootURI + 'style.css';
// 		doc.documentElement.appendChild(link1);
// 		this.storeAddedElement(link1);
		
// 		// Add menu option
// 		let menuitem = doc.createElementNS(XUL_NS, 'menuitem');
// 		menuitem.id = 'make-it-green-instead';
// 		menuitem.setAttribute('type', 'checkbox');
// 		menuitem.setAttribute('data-l10n-id', 'open-inline-citation-green-instead');
// 		menuitem.addEventListener('command', () => {
// 			MakeItRed.toggleGreen(window, menuitem.getAttribute('checked') === 'true');
// 		});
// 		doc.getElementById('menu_viewPopup').appendChild(menuitem);
// 		this.storeAddedElement(menuitem);
		
// 		// Use strings from open-inline-citation.ftl (Fluent) in Zotero 7
// 		if (Zotero.platformMajorVersion >= 102) {
// 			window.MozXULElement.insertFTLIfNeeded("open-inline-citation.ftl");
// 		}
// 		// Use strings from open-inline-citation.properties (legacy properties format) in Zotero 6
// 		else {
// 			let stringBundle = Services.strings.createBundle(
// 				'chrome://open-inline-citation/locale/open-inline-citation.properties'
// 			);
// 			doc.getElementById('make-it-green-instead')
// 				.setAttribute('label', stringBundle.GetStringFromName('makeItGreenInstead.label'));
// 		}
// 	},
	
// 	addToAllWindows() {
// 		return;
// 		var windows = Zotero.getMainWindows();
// 		for (let win of windows) {
// 			if (!win.ZoteroPane) continue;
// 			this.addToWindow(win);
// 		}
// 	},
	
// 	storeAddedElement(elem) {
// 		return;
// 		if (!elem.id) {
// 			throw new Error("Element must have an id");
// 		}
// 		this.addedElementIDs.push(elem.id);
// 	},
	
// 	removeFromWindow(window) {
// 		return;
// 		var doc = window.document;
// 		// Remove all elements added to DOM
// 		for (let id of this.addedElementIDs) {
// 			// ?. (null coalescing operator) not available in Zotero 6
// 			let elem = doc.getElementById(id);
// 			if (elem) elem.remove();
// 		}
// 		doc.querySelector('[href="open-inline-citation.ftl"]').remove();
// 	},
	
// 	removeFromAllWindows() {
// 		return;
// 		var windows = Zotero.getMainWindows();
// 		for (let win of windows) {
// 			if (!win.ZoteroPane) continue;
// 			this.removeFromWindow(win);
// 		}
// 	},
	
// 	toggleGreen(window, enabled) {
// 		return;
// 		let docElem = window.document.documentElement;
// 		// Element#toggleAttribute() is not supported in Zotero 6
// 		if (enabled) {
// 			docElem.setAttribute('data-green-instead', 'true');
// 		}
// 		else {
// 			docElem.removeAttribute('data-green-instead');
// 		}
// 	},
	
// 	async main() {
// 		return;
// 		// Global properties are imported above in Zotero 6 and included automatically in
// 		// Zotero 7
// 		var host = new URL('https://foo.com/path').host;
// 		this.log(`Host is ${host}`);
		
// 		// Retrieve a global pref
// 		this.log(`Intensity is ${Zotero.Prefs.get('extensions.open-inline-citation.intensity', true)}`);
// 	},
// };
