addListeners = async () => {
    
    
    
  const activeTab = Zotero.getActiveZoteroPane();
  const activeDoc = activeTab.document;
  const activeWindow = activeDoc.defaultView;
  const fetch = activeWindow.fetch;

  const readers = Zotero.Reader._readers.filter(
    (r) => r._window.document === activeDoc
  );
  if (readers.length===0) throw new Error("whoops");
  
//   alert(readers[0]._iframeWindow.document.body.innerText)
  
  const windows = await Zotero.getMainWindows();
    for(let fakeWindow of windows){
        for(let i=0;fakeWindow[i];i++) {
    try {
      const window = fakeWindow[i].wrappedJSObject;
      const document = window.document;
    //   if(document.body && document.body.innerText.includes("NOTE")){
    //       alert(`How many as? ${Array.from(document.querySelectorAll("a")).length}. Innertext ? ${document.body.innerText.slice(0,1000)}`)
    //   } else continue;

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
        const res = await (
          await fetch(
            `https://customsearch.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=AIzaSyDfSvIBjkKv4EkkZjK9auGOTJBoS1PRxEE&rsz=filtered_cse&num=3&hl=en&source=gcsc&gss=.com&cselibv=3bd4ac03c21554b3&cx=50682b062590c456e&safe=active&exp=csqr%2Ccc%2Capo`
          )
        ).json();
        if (!res.items) alert(JSON.stringify(res));
        return res.items
          .map((i) => i.link)
          .filter(l=>!(
              l.startsWith("https://scholar.google.com/")
          ))
          .map(l=>
            l.replace("https://arxiv.org/pdf","https://arxiv.org/abs")
            .replace("https://openreview.net/pdf","https://openreview.net/forum")
          )
      }
      window.fetchGoogleAPI = wrapOutside(fetchGoogleAPI);

      async function addToLibrary(url, collectionName) {
          const docs = await Zotero.HTTP.processDocuments(url,doc=>doc);
          const [doc] = docs;
        
            let collections = Zotero.Collections.getByLibrary(
              Zotero.Libraries.userLibraryID
            );
            let collection = collections.find((c) => c.name === collectionName);
            if (!collection) {
              throw new Error(`Collection "${collectionName}" not found`);
            }

            let newItem = null;
            let headResponse = await Zotero.HTTP.request("HEAD", url);
            let contentType = headResponse.getResponseHeader("Content-Type");
            if (contentType && contentType.includes("application/pdf")) {
              newItem = await Zotero.Attachments.importFromURL({
                url: url,
                libraryID: Zotero.Libraries.userLibraryID,
                collections: [collection.key],
              });
            } else {
              let translate = new Zotero.Translate.Web();

              if (url.includes("arxiv.org/abs")) translate.setTranslator("58ab2618-4a25-4b9b-83a7-80cd0259f896");
              if (!doc) throw new Error("No document");
              translate.setDocument(doc);
              
              const tmp = await translate.translate({
                  libraryID: Zotero.Libraries.userLibraryID,
                  collections: [collection.id],
                });

              // Translate the item
              newItem = (
                tmp
              )[0];
            }

            // Open the new item in a new tab
            await activeDoc.defaultView.ZoteroPane_Local.viewItems([newItem]);
      }
      window.addToLibrary = wrapOutside(addToLibrary);

      // Define the function you want to run inside the iframe
        const toEval =
        "(" +
        (async () => {
            // alert('hey')
            window.document.body.style.opacity=1.0;
            try{
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

            if (!rightPage) throw new Error("error, not found");

            const annotations = await rightPage.getAnnotations();
            const links = annotations.filter(annotation => annotation.subtype === 'Link');

            const strippedContent = [
              await rightPage.getTextContent(),
              nextPage && (await nextPage.getTextContent()),
            ]
              .filter((c) => c)
              .map((c) =>c.items)
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
            
            const citationLink = strippedContent.slice(firstMatchIdx,lastMatchIdx).map(i=>
               links
              .filter(({rect,url})=>{
                  const [xMin,yMin,xMax,yMax] = rect;
                  const iCenterX = i.transform[4] + i.width/2;
                  const iCenterY = i.transform[5] + i.height/2;
                  
                  const ret = iCenterX >= xMin && iCenterX <= xMax && iCenterY >= yMin && iCenterY <= yMax;
                  return ret;
              })
            ).reduce((agg,nxt)=>[...agg,...nxt],[])[0];
            
            const citationText = strippedContent
                .slice(firstMatchIdx,lastMatchIdx)
                .map(i=>i.str)
                .reduce((agg,nxt)=>agg.endsWith("-") ? agg.slice(0,-1)+nxt:agg+" "+nxt,"")
                .trim();

            try {
                let url;
                if(citationLink) url = citationLink.url;
                else {
                const results = await fetchGoogleAPI(citationText);
                
                // alert(JSON.stringify(results))

                 url = results[0];
                }

                if (!url)
                  alert(`Found no arXiv results for "${googleQuery}"`);

              const addToLibrary = wrapInside(window.addToLibrary);
              
              // alert(`"${citation}"" ->\n"${citationText}" ->\n "${url}" (from ${citationLink?"metadata":"Google"})`)
              await addToLibrary(url, "Inline citations");
            } catch (err) {
              alert(err);
            }
          }
          
          if(document.body.innerText.includes("lower bounds are summed across")) alert("these lower bounds")

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
                
                // a.style.border="1px solid purple";

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
                  // a.style.border = "1px solid orange";
              }
            });
          }, 500);
        } catch(err){
            alert(err)
        }
        }) +
        ")();";
        
        window.eval(toEval);
        

    } catch (err) {
     alert(err);
    }
  }
    }
  
//   alert("set all listeners")
};

// await addListeners()