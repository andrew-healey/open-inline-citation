// Get the currently open tab
var addListeners = async () => {
const activeTab = Zotero.getActiveZoteroPane();
const activeDoc = activeTab.document

const readers = Zotero.Reader._readers.filter(r => r._window.document === activeDoc);
const reader = readers[0];
if (!reader) throw new Error("whoops")

let window = null;
for(let i=0;reader._window.wrappedJSObject[i];i++) window=reader._window.wrappedJSObject[i].wrappedJSObject;
const document = window.document;

const wrapOutside = (fn) => async (key, ...args) => {
    const promise = fn(...args);
    promise.then(r => window[key].res(JSON.stringify(r))).catch(err => window[key].rej(err + ""));
}

async function fetchAvesAPI(query) {
    const searchUrl = `https://api.avesapi.com/search?apikey=QY430HSN45MNZRG5TKH6KPSZDG8F&type=web&query=${encodeURIComponent(query)}&output=json&num=10`;

    try {
        const response = await fetch(searchUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.result.organic_results;

    } catch (err) {
        if (err.message === 'Failed to fetch') alert("CORS error")
        throw err;
    }
}
window.fetchAvesAPI = wrapOutside(fetchAvesAPI);



async function addToLibrary(url, collectionName) {
    return new Promise(res => {
        Zotero.HTTP.processDocuments(url, async function(doc) {
            // Create a new Web translator instance
            let translate = new Zotero.Translate.Web();

            // Set the translator to the arXiv translator
            translate.setTranslator('58ab2618-4a25-4b9b-83a7-80cd0259f896');

            // Set the document to the fetched document
            translate.setDocument(doc);

            // Get the collection ID
            let collections = Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID);
            let collection = collections.find(c => c.name === collectionName);
            if (!collection) {
                throw new Error(`Collection "${collectionName}" not found`);
            }

            // Translate the item
            let newItems = await translate.translate({
                libraryID: Zotero.Libraries.userLibraryID,
                collections: [collection.id]
            });

            // The newItems array now contains the imported items
            console.log(newItems);

            // Open the first new item in a new tab
            if (newItems.length > 0) {
                try {
                    ZoteroPane_Local.viewItems([newItems[0]]);
                } catch (err) {
                    window.alert(err + "")
                }
            }
        });
    });
}
window.addToLibrary = wrapOutside(addToLibrary);




var script = document.createElement('script');

// Define the function you want to run inside the iframe
script.textContent = "(" + (async () => {
    const {
        pdfjsLib,
        PDFViewerApplication,
        PDFPageProxy
    } = window;
    const pdfDoc = PDFViewerApplication.pdfDocument;

    const wrapInside = (fn) => async (...args) => JSON.parse(await new Promise((res, rej) => {
        const k = Math.random();
        window[k] = {
            res,
            rej
        }
        fn(k, ...args);

    }));

    const fetchAvesAPI = wrapInside(window.fetchAvesAPI);

    async function openInlineCitation(citation) {

        const destination = await pdfDoc.getDestination(citation);
        const loc = destination[0].num;
        const yPos = destination[3];

        let rightPage = null;
        let latestRef = null;
        let nextRef = null;
        for (let pageId = 1; pageId <= pdfDoc.numPages; pageId++) {
            const page = await pdfDoc.getPage(pageId);
            if (page._pageInfo.ref.num === loc) {
                rightPage = page;
                break;
            }
        }

        if (!rightPage) alert("error, not found")

        const textContent = await rightPage.getTextContent();
        const fullPageText = textContent.items.map(i=>i.str).join("\n");

        const apiKey = "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"
        async function fetchOpenAI(pageText,citation) {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: `Here's a page of citations: ${JSON.stringify(pageText)}\nHere's the id of the citation I'm looking for: ${JSON.stringify(citation)}. Tell me the title of the citation I want. Don't say anything besides the title.`
                    }],
                    temperature: 0,
                    max_tokens: 256,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0
                })
            });

            const data = await response.json();
            return data.choices[0].message.content;
        }
        try {
            const googleQuery = await fetchOpenAI(fullPageText,citation);

            //   alert(citation+" -> "+googleQuery);

            // Usage:
            const results = await fetchAvesAPI(googleQuery)

            const arxivResult = results.find(r => r.url.startsWith("https://arxiv.org/abs"))

            if (!arxivResult) alert(`Found no arXiv results for "${googleQuery}"`)
            const url = arxivResult.url;

            // alert(url)

            const addToLibrary = wrapInside(window.addToLibrary);
            await addToLibrary(url, "Inline citations");

        } catch (err) {
            alert(err)
        };
    }

    window.onclick = (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    }

    const watchedEls = new WeakSet;
    setInterval(() => {
        const as = Array.from(document.querySelectorAll("a")).filter(a => !watchedEls.has(a));
        as.forEach(a => watchedEls.add(a));
        as.forEach(a => {
            const href = a.getAttribute("href");
            if (href.startsWith("#cite.")) {
                const tailEnd = href.slice(1);
                a.onclick = (evt) => {
                    (async () => {
                        try {
                            await openInlineCitation(tailEnd);
                        } catch (err) {
                            alert(err)
                        }
                    })();
                    evt.preventDefault();
                    event.stopPropagation();
                    return false;
                }
                return tailEnd
            }
        });
    }, 500);


}) + ")()"

document.body.appendChild(script)
return 1;
};