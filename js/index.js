const readingColors = ["#edd1b0", "#eddd6e", "#f8fd89"];
const bookContentsUrl = "https://gutenberg-proxy.glitch.me";
const bookMetaUrl = "https://gutendex.com";
const bookTopics = [
    "Best Books Ever Listings",
    "Harvard Classics",
    "Short Stories",
    "Banned Books From Anne Haight's List",
    "Science Fiction",
    "England Fiction",
    "Children's Literature",
    "Movie Books",
    "Psychological Fiction",
    "Domestic Fiction"
];
const wordsPerPage = 130;
let currentPage = 0;
let bookText = "";
let globalBookUrl = "";
let globalPage = "index";

function setPage(page) {
    globalPage = page;

    if (page == "index") {
        window.indexPage.setAttribute("visible", true);
        window.bookPage.setAttribute("visible", false);
    }
    if (page == "book") {
        window.bookPage.setAttribute("visible", true);
        window.indexPage.setAttribute("visible", false);
    }
}

function html(elmType, parent, attributes = {}) {
    let elm = document.createElement(elmType);
    Object.entries(attributes).forEach(([prop, value]) => {
        elm.setAttribute(prop, value);
    });
    document.querySelector(parent).appendChild(elm);
    return elm;
}

function showBook(bookUrl) {
    globalBookUrl = bookUrl;
    setPage("book");

    fetch(globalBookUrl)
        .then(r => r.text())
        .then(text => {
            bookText = text;
            currentPage = localStorage.getItem(globalBookUrl) ? Number(localStorage.getItem(globalBookUrl)) : 0;
            loadPage();
        });
}

function loadPage() {
    localStorage.setItem(globalBookUrl, currentPage);

    let totalPages = Math.ceil(bookText.split(" ").length / wordsPerPage);
    let start = currentPage * wordsPerPage;
    let end = start + wordsPerPage;
    let pageText = bookText.split(" ").slice(start, end).join(" ").replace(/[^\x00-\x7F]/g, "");

    pageText = pageText.split("").map(v => (v == " ") ? v : "f").join("")

    window.page.setAttribute("text", {
        value: `Page ${currentPage} of ${totalPages}`
    });
    window.book.setAttribute("text", {
        value: pageText
    });
}

AFRAME.registerComponent('init', {
    init: function () {
        window.exit.addEventListener("click", e => {
            setPage("index");
        });

        let position = {
            x: 0,
            y: 0,
            z: -1
        };

        bookTopics.map(async topic => {
            let req = await fetch(`${bookMetaUrl}/books?topic=${topic}`);
            let json = await req.json();

            html("a-entity", "#body", {
                text: `value: ${topic}; color: #000;`,
                position: { ...position, y: position.y + 1, x: position.x + 1 },
                scale: "5 5 5"
            });

            json.results.forEach((book, i) => {
                let img = bookContentsUrl + new URL(book.formats["image/jpeg"] ?? "").pathname.replace("small", "medium");
                let contentsPath = book.formats["text/plain"] ??
                    book.formats["text/plain; charset=utf-8"] ??
                    book.formats["text/plain; charset=ascii"] ??
                    book.formats["text/plain; charset=us-ascii"];
                let contents = bookContentsUrl + new URL(contentsPath).pathname;
                let title = book.title ? book.title : "No Title Avaliable";

                html("a-entity", "#body", {
                    id: "row" + i,
                    class: "row"
                });
                html("a-entity", "#row" + i, {
                    text: { value: title, color: "#000" },
                    position, scale: "2 2 2"
                });
                html("a-image", "#row" + i, {
                    src: img,
                    position: { ...position, y: position.y - 1, x: position.x - .5 },
                    "data-raycastable": JSON.stringify({
                        type: "link",
                        value: contents
                    }),
                    "click-event": true
                });

                position.x += 2;
            });

            position.x = 0;
            position.y -= 3;
        });
    }
});

AFRAME.registerComponent('thumbstick-logging', {
    init: function () {
        this.el.addEventListener('thumbstickmoved', this.logThumbstickForBookPage);
        this.el.addEventListener('thumbstickmoved', this.logThumbstickForIndexPage);
        this.el.addEventListener("bbuttonup", this.zoomOutForBookPage);
        this.el.addEventListener("abuttonup", this.zoomInForBookPage);
        this.el.addEventListener("ybuttonup", this.zoomOutForBookPage);
        this.el.addEventListener("xbuttonup", this.zoomInForBookPage);
    },
    zoomInForBookPage: function () {
        if (globalPage !== "book") return;

        let pos = window.book.getAttribute("position");
        window.book.setAttribute("position", { ...pos, z: pos.z + .1 });
    },
    zoomOutForBookPage: function () {
        if (globalPage !== "book") return;

        let pos = window.book.getAttribute("position");
        window.book.setAttribute("position", { ...pos, z: pos.z - .1 });
    },
    wait: false,
    logThumbstickForBookPage: function (evt) {
        if (this.wait) return;
        if (globalPage !== "book") return;

        if (evt.detail.y < -0.95) {
            // UP
            let pos = window.book.getAttribute("position");
            window.book.setAttribute("position", { ...pos, y: pos.y + .02 });
        }
        if (evt.detail.y > 0.95) {
            // DOWN
            let pos = window.book.getAttribute("position");
            window.book.setAttribute("position", { ...pos, y: pos.y - .02 });
        }
        if (evt.detail.x < -.95) {
            // Left
            this.wait = true;
            setTimeout(() => this.wait = false, 500);

            currentPage -= 1;
            if (currentPage < 0) currentPage = 0;
            loadPage();
        }
        if (evt.detail.x > .95) {
            // Right
            this.wait = true;
            setTimeout(() => this.wait = false, 500);

            let totalPages = Math.ceil(bookText.split(" ").length / wordsPerPage);
            currentPage += 1;
            if (currentPage > totalPages) currentPage = totalPages;
            loadPage();
        }
    },
    logThumbstickForIndexPage: function (evt) {
        if (globalPage !== "index") return;

        if (evt.detail.y < -0.95) {
            // UP
            let pos = window.body.getAttribute("position");
            window.body.setAttribute("position", { ...pos, y: pos.y - .1 });
        }
        if (evt.detail.y > 0.95) {
            // DOWN
            let pos = window.body.getAttribute("position");
            window.body.setAttribute("position", { ...pos, y: pos.y + .1 });
        }
        if (evt.detail.x < -0.95) {
            //LEFT
            document.querySelectorAll(".row").forEach(row => {
                let pos = row.getAttribute("position");
                row.setAttribute("position", { ...pos, x: pos.x - .1 });
            });
        }
        if (evt.detail.x > 0.95) {
            //Right
            document.querySelectorAll(".row").forEach(row => {
                let pos = row.getAttribute("position");
                row.setAttribute("position", { ...pos, x: pos.x + .1 });
            });
        }
    }
});

AFRAME.registerComponent('click-event', {
    init: function () {
        this.el.addEventListener("click", e => {
            let { type, value } = JSON.parse(this.el.dataset.raycastable);

            if (type == "link") {
                showBook(value);
            }
        })
    }
});









