var MakeItRed;
var addListeners;

function log(msg) {
	Zotero.debug("Open Inline Citation: " + msg);
}

function install() {
	log("Installed 2.0");
}

async function startup({ id, version, rootURI }) {
	log("Starting 2.0");
	
	Zotero.PreferencePanes.register({
		pluginID: 'open-inline-citation@example.com',
	});
	
	Services.scriptloader.loadSubScript(rootURI + 'inline-citations.js');
	Zotero.Notifier.registerObserver({
		notify: function(event, type, ids, extraData) {
			if (event === 'select' && type === 'tab') {
				console.log('Tab switched to', ids[0]);
				addListeners();
			}
		}
	}, ['tab']);
}

function onMainWindowLoad({ window }) {
	// MakeItRed.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	// MakeItRed.removeFromWindow(window);
}

function shutdown() {
	log("Shutting down 2.0");
	// MakeItRed.removeFromAllWindows();
	MakeItRed = undefined;
}

function uninstall() {
	log("Uninstalled 2.0");
}
