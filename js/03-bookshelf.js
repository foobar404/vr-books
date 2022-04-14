AFRAME.registerComponent("bookshelf", {
    init: function () {
        this.vars = {
            topicIndex: 9,
            topicPage: 0,
            topicsPerPage: 12,
            topicRows: 5,
            topicRowHeight: .8,
            topicData: {},
            topicPosition: {},
            thumbstickWaitTime: 0
        };

        document.querySelector("#leftHand").addEventListener('thumbstickmoved', this.handleThumbstick.bind(this));
        document.querySelector("#rightHand").addEventListener('thumbstickmoved', this.handleThumbstick.bind(this));
        document.body.addEventListener("keypress", ({ key }) => {
            if (key == "j") { this.handleThumbstick({ detail: { x: -1, y: 0, z: 0 } }) }
            if (key == "l") { this.handleThumbstick({ detail: { x: 1, y: 0, z: 0 } }) }
            if (key == "i") { this.handleThumbstick({ detail: { x: 0, y: -1, z: 0 } }) }
            if (key == "k") { this.handleThumbstick({ detail: { x: 0, y: 1, z: 0 } }) }
        });
    },
    update: function(){
        this.loadBooks();
    },
    handleThumbstick: function (evt) {
        if (PAGE_STATE !== PAGE_STATE_VALUES.browsing) return;
        if (!(Date.now() >= this.vars.thumbstickWaitTime)) return;

        let degreesPerTurn = 360 / this.vars.topicsPerPage;
        let rotation = this.el.getAttribute("rotation")?.y ?? 0;

        if (evt.detail.y < -0.95) {
            // UP
            this.vars.thumbstickWaitTime = Date.now() + 250;
            let currentTopics = TOPICS.slice(this.vars.topicPage * this.vars.topicsPerPage, this.vars.topicPage * this.vars.topicsPerPage + this.vars.topicsPerPage)
            let currentTopic = currentTopics[this.vars.topicIndex];
            let maxPosition = this.vars.topicData[currentTopic].results.length / this.vars.topicRows;

            this.vars.topicPosition[currentTopic] += 1;

            if (this.vars.topicPosition[currentTopic] > maxPosition) {
                if (!this.vars.topicData[currentTopic].next) {
                    this.vars.topicPosition[currentTopic] -= 1;
                }
                else {
                    axios.get(this.vars.topicData[currentTopic].next).then(res => {
                        this.vars.topicData[currentTopic] = res.data;
                        this.vars.topicPosition[currentTopic] = 0;

                        this.updateBooks();
                    })
                }
            } else {
                this.updateBooks();
            }
        }
        if (evt.detail.y > 0.95) {
            // DOWN
            this.vars.thumbstickWaitTime = Date.now() + 250;
            let currentTopics = TOPICS.slice(this.vars.topicPage * this.vars.topicsPerPage, this.vars.topicPage * this.vars.topicsPerPage + this.vars.topicsPerPage)
            let currentTopic = currentTopics[this.vars.topicIndex];
            let maxPosition = this.vars.topicData[currentTopic].results.length / this.vars.topicRows;

            this.vars.topicPosition[currentTopic] -= 1;

            if (this.vars.topicPosition[currentTopic] < 0) {
                if (!this.vars.topicData[currentTopic].previous) {
                    this.vars.topicPosition[currentTopic] += 1;
                }
                else {
                    axios.get(this.vars.topicData[currentTopic].previous).then(res => {
                        this.vars.topicData[currentTopic] = res.data;
                        this.vars.topicPosition[currentTopic] = Math.floor(maxPosition);

                        this.updateBooks();
                    })
                }
            } else {
                this.updateBooks();
            }
        }
        if (evt.detail.x < -.95) {
            // Left
            this.vars.thumbstickWaitTime = Date.now() + 250;
            this.el.setAttribute("animation", {
                property: "rotation.y",
                to: rotation + degreesPerTurn,
                dur: 250
            });

            this.vars.topicIndex += 1;
            if (this.vars.topicIndex > this.vars.topicsPerPage) this.vars.topicIndex = 0;
        }
        if (evt.detail.x > .95) {
            // Right
            this.vars.thumbstickWaitTime = Date.now() + 250;
            this.el.setAttribute("animation", {
                property: "rotation.y",
                to: rotation - degreesPerTurn,
                dur: 250
            });

            this.vars.topicIndex -= 1;
            if (this.vars.topicIndex < 0) this.vars.topicIndex = this.vars.topicsPerPage - 1;
        }
    },
    updateBooks: function () {
        let currentTopics = TOPICS.slice(this.vars.topicPage * this.vars.topicsPerPage, this.vars.topicPage * this.vars.topicsPerPage + this.vars.topicsPerPage)
        let currentTopic = currentTopics[this.vars.topicIndex];
        let topicContainer = document.querySelector(`#${makeSafeForCSS(currentTopic)}`);
        let bookStart = this.vars.topicPosition[currentTopic] * this.vars.topicRows;
        let books = this.vars.topicData[currentTopic].results.slice(bookStart, bookStart + this.vars.topicRows);

        Array.from(topicContainer.children).forEach((child, i) => {
            let book = books[i];
            if (!book) return;

            let cover = book.formats["image/jpeg"] ?
                BOOK_TEXT_URL + new URL(book.formats["image/jpeg"]).pathname.replace("small", "medium") :
                "./assets/images/bookCover.jpg";
            let textURL = book.formats["text/plain"] ??
                book.formats["text/plain; charset=utf-8"] ??
                book.formats["text/plain; charset=ascii"] ??
                book.formats["text/plain; charset=us-ascii"];
            let text = BOOK_TEXT_URL + new URL(textURL).pathname;
            let title = book.title ? book.title : "No Title Avaliable";

            child.setAttribute("animation", {
                property: "rotation.y",
                dur: 250,
                to: child.getAttribute("rotation").y += 360
            });
            child.setAttribute("title", title);
            child.setAttribute("text", text);
            child.setAttribute("cover", cover);
        })
    },
    loadBooks: function () {
        let topicsStart = this.vars.topicPage * this.vars.topicsPerPage;
        let degreesPerTurn = 360 / this.vars.topicsPerPage;
        let distanceFromPerson = 2;

        this.el.innerHTML = "";

        TOPICS.slice(topicsStart, topicsStart + this.vars.topicsPerPage).forEach(async (topic, i) => {
            let json = (await axios.get(`${BOOK_META_URL}?topic=${topic}`)).data;

            this.vars.topicData[topic] = json;
            this.vars.topicPosition[topic] = 0;

            let topicContainer = $("a-entity", "#bookshelf", { id: `${makeSafeForCSS(topic)}` });
            let bookStart = this.vars.topicPosition[topic] * this.vars.topicRows;
            let totalHeight = this.vars.topicRowHeight * this.vars.topicRows;
            let position = {
                x: 0,
                y: (totalHeight / 2) + this.vars.topicRowHeight,
                z: 0
            };

            this.vars.topicData[topic].results.slice(bookStart, bookStart + this.vars.topicRows).forEach((book, j) => {
                let cover = book.formats["image/jpeg"] ?
                    BOOK_TEXT_URL + new URL(book.formats["image/jpeg"]).pathname.replace("small", "medium") :
                    "./assets/images/bookCover.jpg";
                let textURL = book.formats["text/plain"] ??
                    book.formats["text/plain; charset=utf-8"] ??
                    book.formats["text/plain; charset=ascii"] ??
                    book.formats["text/plain; charset=us-ascii"];
                let textLink = BOOK_TEXT_URL + new URL(textURL).pathname;
                let title = book.title ? book.title : "No Title Avaliable";

                let toRadians = degrees => degrees * (Math.PI / 180);
                let x = 0 + distanceFromPerson * Math.cos(toRadians(degreesPerTurn * i));
                let z = 0 + distanceFromPerson * Math.sin(toRadians(degreesPerTurn * i));

                position.x = x;
                position.z = z;
                position.y -= this.vars.topicRowHeight;

                if (j == 0) {
                    $("a-text", "#bookshelf", {
                        rotation: `${30 - (15 * j)} -${(degreesPerTurn * i) + 90} 0`,
                        value: topic,
                        position: { ...position, y: position.y + 1 },
                        scale: ".4 .4 1",
                        align: "center"
                    })
                }

                $("a-book", topicContainer, {
                    rotation: `${30 - (15 * j)} -${(degreesPerTurn * i) + 90} 0`,
                    position,
                    title,
                    textLink,
                    cover,
                    height: .6,
                    width: .3,
                    clickable: true
                });
            })
        })
    }
})





