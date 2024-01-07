addListeners = async () => {
  const activeTab = Zotero.getActiveZoteroPane();
  const activeDoc = activeTab.document;
  const activeWindow = activeDoc.defaultView;
  const fetch = activeWindow.fetch;

  const readers = Zotero.Reader._readers.filter(
    (r) => r._window.document === activeDoc
  );
  const reader = readers[0];
  if (!reader) throw new Error("whoops");

  for (let i = 0; reader._window.wrappedJSObject[i]; i++) {
    try {
      const window = reader._window.wrappedJSObject[i].wrappedJSObject;
      const document = window.document;

      if (!document.body) {
        window.onload = () => addListeners();
        continue;
      }

      if (window.citeListenersInterval !== undefined)
        window.clearInterval(window.citeListenersInterval);

      const wrapOutside =
        (fn) =>
        async (key, ...args) => {
          const promise = fn(...args);
          promise
            .then((r) => window[key].res(JSON.stringify(r)))
            .catch((err) => window[key].rej(err + ""));
        };

      async function fetchGoogleAPI(query) {
        //   alert(encodeURIComponent(query))
        const res = await (
          await fetch(
            `https://customsearch.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=AIzaSyDfSvIBjkKv4EkkZjK9auGOTJBoS1PRxEE&cx=b11bc5cc9867043ab`
          )
        ).json();
        if (!res.items) alert(JSON.stringify(res));
        return res.items.map((i) => i.link);
      }
      window.fetchGoogleAPI = wrapOutside(fetchGoogleAPI);

      async function addToLibrary(url, collectionName) {
        return new Promise((res) => {
          Zotero.HTTP.processDocuments(url, async function (doc) {
            // Get the collection ID
            let collections = Zotero.Collections.getByLibrary(
              Zotero.Libraries.userLibraryID
            );
            let collection = collections.find((c) => c.name === collectionName);
            if (!collection) {
              throw new Error(`Collection "${collectionName}" not found`);
            }

            let newItem = null;

            if (url.endsWith(".pdf")) {
              newItem = await Zotero.Attachments.importFromURL({
                url: url,
                libraryID: Zotero.Libraries.userLibraryID,
                collections: [collection.key],
              });
            } else {
              let translate = new Zotero.Translate.Web();

              if (url.includes("arxiv"))
                translate.setTranslator("58ab2618-4a25-4b9b-83a7-80cd0259f896");
              if (!doc) throw new Error("No document");
              translate.setDocument(doc);

              // Translate the item
              newItem = (
                await translate.translate({
                  libraryID: Zotero.Libraries.userLibraryID,
                  collections: [collection.id],
                })
              )[0];
            }

            // Open the new item in a new tab
            activeDoc.defaultView.ZoteroPane_Local.viewItems([newItem]);
            res();
          });
        });
      }
      window.addToLibrary = wrapOutside(addToLibrary);


      var script = document.createElement("script");

      // Define the function you want to run inside the iframe
      script.textContent =
        "(" +
        (async () => {
          const wrapInside =
            (fn) =>
            async (...args) => {
              const res = await new Promise((res, rej) => {
                const k = Math.random();
                window[k] = {
                  res,
                  rej,
                };
                fn(k, ...args);
              });
              return res && JSON.parse(res);
            };

          const fetchGoogleAPI = wrapInside(window.fetchGoogleAPI);

          async function openInlineCitation(citation) {
            const startTime = Date.now();
            const { pdfjsLib, PDFViewerApplication, PDFPageProxy } = window;
            const pdfDoc = PDFViewerApplication.pdfDocument;
            const destination = await pdfDoc.getDestination(
              decodeURIComponent(citation)
            );
            if (!destination)
              alert(decodeURIComponent(citation) + " not found");
            const loc = destination[0].num;
            const targetY = destination[3];
            const targetX = destination[2];

            let rightPage = null;
            let nextPage = null;
            for (let pageId = 1; pageId <= pdfDoc.numPages; pageId++) {
              const page = await pdfDoc.getPage(pageId);
              if (page._pageInfo.ref.num === loc) {
                rightPage = page;
                if (pageId < pdfDoc.numPages)
                  nextPage = await pdfDoc.getPage(pageId + 1);
                break;
              }
            }

            if (!rightPage) alert("error, not found");

            const strippedContent = [
              await rightPage.getTextContent(),
              nextPage && (await nextPage.getTextContent()),
            ]
              .filter((c) => c)
              .map((c) =>
                c.items.map((i) => ({
                  str: i.str,
                  transform: i.transform,
                  height: i.height,
                }))
              )
              .reduce((agg, nxt) => [...agg, ...nxt], []);

            const firstMatchIdx = strippedContent.findIndex(
              (i) => i.transform[4] > targetX && i.transform[5] < targetY
            );

            let lastMatchIdx = strippedContent.findIndex(
              (i, idx) =>
                idx > firstMatchIdx &&
                Math.abs(
                  i.transform[5] - strippedContent[idx - 1].transform[5]
                ) >=
                  i.height * 1.5 &&
                strippedContent[idx - 1].str.endsWith(".")
            );
            if (lastMatchIdx < 0) lastMatchIdx += strippedContent.length;
            const citationText = strippedContent
                .slice(firstMatchIdx,lastMatchIdx)
                .map(i=>i.str)
                .reduce((agg,nxt)=>agg.endsWith("-") ? agg.slice(0,-1)+nxt:agg+" "+nxt,"")
                .trim();

            try {
                const results = await fetchGoogleAPI(citationText);

                const url = results[0];

                if (!url)
                  alert(`Found no arXiv results for "${googleQuery}"`);

              const addToLibrary = wrapInside(window.addToLibrary);
              await addToLibrary(url, "Inline citations");
            } catch (err) {
              alert(err);
            }
          }

          const watchedEls = new WeakSet();
          window.citeListenersInterval = setInterval(() => {
            const as = Array.from(document.querySelectorAll("a")).filter(
              (a) => !watchedEls.has(a)
            );
            as.forEach((a) => watchedEls.add(a));
            as.forEach((a) => {
              const href = a.getAttribute("href");
              if (href.startsWith("#cite.")) {
                const tailEnd = href.slice(1);
                const oldOnClick = a.onclick;

                a.onclick = (evt) => {
                  if (evt.metaKey || evt.ctrlKey) {
                    (async () => {
                      try {
                        await openInlineCitation(tailEnd);
                      } catch (err) {
                        alert(err);
                      }
                    })();
                    evt.preventDefault();
                    evt.stopPropagation();
                    return false;
                  }
                  return oldOnClick.call(this, evt);
                };
                return tailEnd;
              }
            });
          }, 500);
        }) +
        ")()";

      document.body.appendChild(script);
    } catch (err) {
      activeDoc.defaultView.alert(err);
    }
  }
};