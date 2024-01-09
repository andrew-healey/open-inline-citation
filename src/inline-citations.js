addListeners = async (doDebug=false) => {
  const activeTab = Zotero.getActiveZoteroPane();
  const activeDoc = activeTab.document;
  const activeWindow = activeDoc.defaultView;
  const {fetch,alert} = activeWindow;

  const readers = Zotero.Reader._readers.filter(
    (r) => r._window.document === activeDoc
  );
  if (readers.length === 0) throw new Error("No readers detected");

  const windows = await Zotero.getMainWindows();
  for (let fakeWindow of windows) {
    for (let i = 0; fakeWindow[i]; i++) {
      try {
        const window = fakeWindow[i].wrappedJSObject;
        const document = window.document;

        if (!document.body) {
          window.onload = () => addListeners();
          continue;
        }
        if(!document.title.endsWith("PDF.js viewer")) continue;

        const readers = Zotero.Reader._readers.filter( (r) => r._iframeWindow && r._iframeWindow.document.wrappedJSObject === document);
        if(readers.length!==1) alert("Error: no Reader matches this PDF! "+document.title)
        const [reader] = readers;

        const itemID = reader.itemID
        window.itemID = itemID;

        window.doDebug = doDebug;

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

          // const metaphorQuery = async (query) => {
          //   const url = 'https://api.metaphor.systems/search';
          //   const apiKey = '31c0a685-5434-4a68-ab73-d018e15cd14d'; // Replace with your API key
          //   const useAutoprompt = false; // Set to true if you want to use a traditional query
          
          //   const body = {
          //     query: query,
          //     useAutoprompt: useAutoprompt,
          //     numResults: 10, // Optional, defaults to 10
          //     // Other optional parameters can be added here,
          //       type:"keyword",
          //       // excludeDomains:["scholar.google.com","dl.acm.org"]
          //   };
          
          //   const response = await fetch(url, {
          //     method: 'POST',
          //     headers: {
          //       'Content-Type': 'application/json',
          //       'X-Api-Key': apiKey,
          //     },
          //     body: JSON.stringify(body),
          //   });
          
          //   if (!response.ok) {
          //     throw new Error(`HTTP error! status: ${response.status}`);
          //   }
          
          //   const data = await response.json();
          // return data.results.map(r=>r.url);
          // };

          // fetchGoogleAPI = metaphorQuery;
          
          // await metaphorQuery('Ronan Collobert, Jason Weston, Leon Bottou, Michael Karlen nad Koray Kavukcuoglu, and Pavel Kuksa. Natural Language Processing (Almost) from Scratch. Journal of Machine Learning Research')

        async function fetchGoogleAPI(query) {
          const res = await (
          await fetch(
            `https://customsearch.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=AIzaSyDfSvIBjkKv4EkkZjK9auGOTJBoS1PRxEE&rsz=filtered_cse&num=3&hl=en&source=gcsc&gss=.com&cselibv=3bd4ac03c21554b3&cx=50682b062590c456e&safe=active&exp=csqr%2Ccc%2Capo`
          )
        ).json();
          if (!res.items) {
            res.query = query;
            alert(JSON.stringify(res));
          }
          return res.items
            .map((i) => i.link)
            .filter((l) =>
            !l.startsWith("https://scholar.google.com/") &&
            !l.startsWith("https://dl.acm.org/")
            )
            .map((l) =>
              l
                .replace("https://arxiv.org/pdf", "https://arxiv.org/abs")
                .replace(
                  "https://openreview.net/pdf",
                  "https://openreview.net/forum"
                )
            );
        }
        window.fetchGoogleAPI = wrapOutside(fetchGoogleAPI);

        async function addToLibrary(url, currItemID) {
          const docs = await Zotero.HTTP.processDocuments(url, (doc) => doc);
          const [doc] = docs;

          // let collections = Zotero.Collections.getByLibrary(
          //   Zotero.Libraries.userLibraryID
          // );
          // let collection = collections.find((c) => c.name === collectionName);
          // if (!collection) {
          //   throw new Error(`Collection "${collectionName}" not found`);
          // }

          let newItem = null;
          let headResponse = await Zotero.HTTP.request("HEAD", url);
          let contentType = headResponse.getResponseHeader("Content-Type");
          if (contentType && contentType.includes("application/pdf")) {
            newItem = await Zotero.Attachments.importFromURL({
              url: url,
              libraryID: Zotero.Libraries.userLibraryID,
              // collections: [collection.key],
            });
          } else {
            let translate = new Zotero.Translate.Web();

            if (url.includes("arxiv.org/abs"))
              translate.setTranslator("58ab2618-4a25-4b9b-83a7-80cd0259f896");
            if (!doc) throw new Error("No document");
            translate.setDocument(doc);

            const tmp = await translate.translate({
              libraryID: Zotero.Libraries.userLibraryID,
              // collections: [collection.id],
            });

            // Translate the item
            newItem = tmp[0];
          }


          // Assume oldItemID is the ID of the old item
          if(currItemID){
              let oldItemFile = await Zotero.Items.getAsync(currItemID);
              let oldItem = oldItemFile.parentItem;//await Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, oldItemFile.parentItem);
              let oldItemCollections = oldItem.getCollections();
    
              // Add the new item to the same collections as the old item
              newItem.setCollections(oldItemCollections);
          }

        //   newItem = await Zotero.Items.getAsync(newItem.id);
          // Add the tag to the new item
          newItem.addTag("inline-citation");
          // Save the changes to the item
          await newItem.saveTx();
          // Open the new item in a new tab
          await activeDoc.defaultView.ZoteroPane_Local.viewItems([newItem]);
        }
        window.addToLibrary = wrapOutside(addToLibrary);

        // Define the function you want to run inside the iframe
        const toEval =
          "(" +
          (async () => {
            window.document.body.style.opacity = 1.0;
            try {
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
                const { PDFViewerApplication } = window;
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

                if (!rightPage) throw new Error("error, not found");

                const annotations = await rightPage.getAnnotations();
                const links = annotations.filter(
                  (annotation) => annotation.subtype === "Link"
                );

                const strippedContent = [
                  await rightPage.getTextContent(),
                  nextPage && (await nextPage.getTextContent()),
                ]
                  .filter((c) => c)
                  .map((c) => c.items)
                  .reduce((agg, nxt) => [...agg, ...nxt], []);

                const firstMatchIdx = strippedContent.findIndex(
                  (i,idx) => (i.transform[4]+i.width/2) >= targetX && i.transform[5] + i.height/2 <= targetY
                  // and is a newline
                  // Prevents bugs with i.e. McAuley et al 2015 in the WT5 paper
                  && (
                      Math.abs(i.transform[5] - strippedContent[idx - 1].transform[5]) >= i.height * 0.5 ||
                      i.str.match(/\[\d+\]/)
                     )
                );

                let lastMatchIdx = strippedContent.findIndex(
                  (i, idx) =>
                    idx > firstMatchIdx && (
                        Math.abs(
                          i.transform[5] - strippedContent[idx - 1].transform[5]
                        ) >=
                          i.height * 1.25 &&
                        // assume that every citation ends with a period.
                        strippedContent[idx - 1].str.endsWith(".")
                        // but sometimes this isn't true (see Visual Instruction Tuning), so we also assume every [1] is a new citation
                        || i.str.match(/\[\d+\]/)
                    )
                );
                if (lastMatchIdx < 0) lastMatchIdx += strippedContent.length;

                const citationLink = strippedContent
                  .slice(firstMatchIdx, lastMatchIdx)
                  .map((i) =>
                    links.filter(({ rect, url }) => {
                      const [xMin, yMin, xMax, yMax] = rect;
                      const iCenterX = i.transform[4] + i.width / 2;
                      const iCenterY = i.transform[5] + i.height / 2;

                      return url && iCenterX >= xMin &&
                        iCenterX <= xMax &&
                        iCenterY >= yMin &&
                        iCenterY <= yMax;
                    })
                  )
                  .reduce((agg, nxt) => [...agg, ...nxt], [])[0];

                const citationText = strippedContent
                  .slice(firstMatchIdx, lastMatchIdx)
                  .map((i) => i.str)
                  .reduce(
                    (agg, nxt) =>
                      agg.endsWith("-")
                        ? agg.slice(0, -1) + nxt
                        : agg + " " + nxt,
                    ""
                  )
                  .trim()
                  // remove words with *no* letters
                  .split(" ").filter(w=>w.match(/[a-zA-Z]/)).join(" ");

                try {
                  let results;
                  let url;
                  if (citationLink) url = citationLink.url;
                  else {
                    results = await fetchGoogleAPI(citationText);

                    url = results[0];
                  }

                  if (!url)
                    throw new Error(`Found no results for "${citationText}"`);
                  
                  if(doDebug) alert(`${citation} ->\n${JSON.stringify(citationText)} ->\n${url} (from ${citationLink ? "metadata" : "Google"})${citationLink ? "" : "\n\n"+results.join("\n")}}`)

                  const addToLibrary = wrapInside(window.addToLibrary);

                  await addToLibrary(url, window.itemID);
                } catch (err) {
                  alert(err+"\n"+err.stack);
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
                  if (href.startsWith("#")) {
                    const tailEnd = href.slice(1);
                    const oldOnClick = a.onclick;

                    if(doDebug)
                      a.style.border="1px solid purple";

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
                  } else {
                    if(doDebug)
                      a.style.border = "1px solid orange";
                  }
                });
              }, 500);
            } catch (err) {
              alert(err+"\n"+err.stack);
            }
          }) +
          ")();";

        window.eval(toEval);
      } catch (err) {
        alert(err+"\n"+err.stack);
      }
    }
  }

};

// await addListeners(true)
