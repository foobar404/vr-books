AFRAME.registerComponent("book-data", {
    schema: {
        title: { type: 'string', default: "" },
        textLink: { type: 'string', default: "" }
    },
    init: function () {
        this.vars = {
            thumbstickWaitTime: 0,
            currentPage: 0,
            pageLength: 130,
            pages: [],
            open: false,
        };

        this.el.addEventListener("click", this.handleClick.bind(this));
        document.querySelector("#leftHand").addEventListener('thumbstickmoved', this.handleThumbstick.bind(this));
        document.querySelector("#rightHand").addEventListener('thumbstickmoved', this.handleThumbstick.bind(this));
        document.body.addEventListener("keypress", ({ key }) => {
            if (key == "j") { this.turnPagePrev() }
            if (key == "l") { this.turnPageNext() }
        });

        let { height, width } = this.el.getAttribute('geometry');

        this.titleElm = $("a-text", this.el,
            {
                color: "#fff",
                align: "center",
                width: width,
                wrapCount: 20.0,
                "wrap-count": 20.0,
                value: this.data.title,
                geometry: `primitive: plane; width: ${width}; height: ${height * .40}`,
                material: "color: black; opacity: 0.7; transparent: true",
                position: `0 -${(height / 2) - (height * .20)} .055`
            });

        this.vars.currentPage = localStorage.getItem(this.data.title) ? Number(localStorage.getItem(this.data.title)) : 0;
    },
    update: function () {
        this.titleElm.setAttribute("value", this.data.title);
    },
    handleThumbstick: function (evt) {
        if (!(Date.now() >= this.vars.thumbstickWaitTime)) return;

        if (evt.detail.x < -.95) {
            // Left
            this.vars.thumbstickWaitTime = Date.now() + 250;
            this.turnPagePrev();
        }
        if (evt.detail.x > .95) {
            // Right
            this.vars.thumbstickWaitTime = Date.now() + 250;
            this.turnPageNext();
        }
    },
    turnPageNext: function () {
        if (PAGE_STATE !== PAGE_STATE_VALUES.reading) return;
        if (!this.vars.open) return;

        this.vars.currentPage += 1;
        if (this.vars.currentPage >= this.vars.pages.length) this.vars.currentPage = this.vars.pages.length - 1;

        localStorage.setItem(this.data.title, this.vars.currentPage);
        this.loadPage();
    },
    turnPagePrev: function () {
        if (PAGE_STATE !== PAGE_STATE_VALUES.reading) return;
        if (!this.vars.open) return;

        this.vars.currentPage -= 1;
        if (this.vars.currentPage < 0) this.vars.currentPage = 0;

        localStorage.setItem(this.data.title, this.vars.currentPage);
        this.loadPage();
    },
    handleClick: function () {
        if (this.vars.open) return;

        let destination = document.querySelector("#camera").getAttribute("position");
        this.el.setAttribute("animation__001", {
            property: "position",
            to: `${destination.x} ${destination.y} ${destination.z - .6}`,
            dur: 500
        });
        this.el.setAttribute("animation__002", {
            property: "rotation",
            to: "-45 0 0",
            dur: 500
        });

        axios.get(this.el.getAttribute("textLink")).then(res => {
            let words = res.data
                .split("\r\n\r\n")
                .map(v => v.replaceAll("\r\n", ""))
                .join("\r\n\r\n")
                .split(" ");
            let totalPages = Math.ceil(words.length / this.vars.pageLength);
            let pages = [];

            for (let i = 0; i < totalPages; i++) {
                let start = this.vars.pageLength * i;
                pages.push(words.slice(start, start + this.vars.pageLength).join(" "));
            }

            this.vars.pages = pages;
            this.vars.open = true;
            this.read();
        });

        mixpanel.track("Book", { title: this.data.title });
    },
    read: function () {
        PAGE_STATE = PAGE_STATE_VALUES.reading;
        let { width, height } = this.el.getAttribute("geometry");

        this.textElm = $("a-text", this.el,
            {
                value: "",
                anchor: "center",
                align: "left",
                baseline: "center",
                color: "#000",
                "letter-space": 4.0,
                "wrap-count": 45.0,
                geometry: `primitive: plane; width: ${width}; height: ${height}`,
                material: `color: #edd1b0`,
                position: `0 0 .06`,
                width: width
            });

        $("a-text", this.el, {
            value: "EXIT",
            color: "red",
            position: ".2 .2 .06",
            clickable: true,
            scale: ".3 .3 1",
            geometry: `primitive: plane`,
            material: "color: black; opacity: 0.0; transparent: true"
        }).addEventListener("click", () => {
            PAGE_STATE = PAGE_STATE_VALUES.browsing;

            this.el.remove();
            document.querySelector("#bookshelf").setAttribute("foo", "bar");
        });

        this.loadPage();
    },
    loadPage: function () {
        if (!this.textElm) return;

        this.textElm.setAttribute("value", this.vars.pages[this.vars.currentPage]);
    }
});

AFRAME.registerPrimitive("a-book", {
    defaultComponents: {
        geometry: { primitive: "box", width: .4, height: .7, depth: .1 },
        "multi-material": { srcs: ["#bookPages", "#bookPages", "#bookPages2", "#bookPages2", "#bookCover", "#bookBack"] },
        "book-data": {},
        grabbable: {},
        // "static-body": {}
        // stretchable: {}
    },
    mappings: {
        cover: "multi-material.src4",
        title: "book-data.title",
        textLink: "book-data.textLink",
        height: "geometry.height",
        width: "geometry.width",
    }
});