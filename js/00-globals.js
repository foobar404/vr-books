const TOPICS = ["Best Books Ever Listings", "Movie Books", "Science", "Banned Books from Anne Haight's list", "Gothic Fiction", "Harvard Classics", "Horror", "Love", "Science Fiction", "Children's Literature", "Historical Fiction", "Philosophy", "Precursors of Science Fiction", "Adventure", "Fantasy", "Psychology", "Science Fiction by Women", "Poetry", "Africa", "United States", "Humor", "Politics", "Short Stories", "France", "Art", "Detective Fiction", "Banned Books List from the American Library Association", "Travel", "Plays", "Classical Antiquity", "African American Writers", "Mystery Fiction", "Contemporary Reviews", "Germany", "India", "Animal", "Opera", "Bestsellers, American, 1895-1923", "Italy", "Slavery", "Folklore", "Christianity", "Canada", "Medicine", "Erotic Fiction", "Mythology", "Education", "US Civil War", "Mathematics", "Greece", "Christmas", "Children's Picture Books", "Crime Fiction", "Natural History", "Children's Myths, Fairy Tales, etc.", "Napoleonic(Bookshelf)", "DE Prosa", "Scouts", "Music", "Arthurian Legends", "Pirates, Buccaneers, Corsairs, etc.", "FR Littérature", "One Act Plays", "Judaism", "Children's History", "Cookbooks and Cooking", "Western", "DE Sachbuch", "Physics", "Crime Nonfiction", "Buddhism", "Architecture", "Witchcraft", "Sociology", "Australia", "Reference", "Technology", "Atheism", "Language Education", "Animals-Domestic", "Crafts", "Children's Instructional Books", "Children's Fiction", "6 Best Loved Spanish Literary Classics", "World War I", "Egypt", "New Zealand", "Biology", "Paganism", "School Stories", "South America", "United Kingdom", "Astronomy", "Native America", "South Africa", "Botany", "Anthropology", "Animals-Wild", "Hinduism", "Bibliomania", "Czech", "United States Law", "Racism", "DE Kinderbuch", "Children's Anthologies", "FR Poésie", "DE Drama", "Woodwork", "Astounding Stories", "Anarchism", "Geology", "Norway", "Biographies", "Esperanto", "Chemistry", "Archaeology", "Islam", "Engineering", "Suffrage", "Children's Book Series", "FR Philosophie, Religion et Morale", "Zoology", "FR Nouvelles", "FR Théâtre", "Horticulture", "FR Séduction et libertinage", "Camping", "FR Biographie, Mémoires, Journal intime, Correspondance", "DE Lyrik", "FR Illustrateurs", "Early English Text Society", "Latter Day Saints", "CIA World Factbooks", "FR Sciences et Techniques", "FR Nouveautés", "Children's Verse", "Manufacturing", "FR Contes", "FR Science fiction", "Animals-Wild-Birds", "Photography", "World War II", "Bulgaria", "FR Peuples et Sociétés", "Physiology", "IT Poesia", "FR Jeunesse", "Argentina", "American Revolutionary War", "FR Voyages et pays", "FR Langues", "German Language Books", "FR Histoire", "FR Humour", "Animals-Wild-Trapping", "Boer War", "Punch", "Animals-Wild-Mammals", "British Law", "Women's Travel Journals", "FR Femmes", "FR Education et Enseignement", "FR Chroniques", "Scientific American", "Animals-Wild-Insects", "IT Letteratura", "IT Romanzi", "Transportation", "Blackwood's Edinburgh Magazine", "FR Politique", "Ecology", "Forestry", "Masterpieces in Colour", "Child's Own Book of Great Musicians", "PT Poesia", "Notes and Queries", "Microscopy", "Harper's New Monthly Magazine", "PT Romance", "Children's Biography", "Mediæval Town Series", "Children's Religion", "The Atlantic Monthly", "Bahá'í Faith", "Project Gutenberg", "FR Peinture", "IT Storia", "IT Racconti", "FR Musique", "The International Magazine of Literature, Art, and Science", "FR Villes", "PT Contos", "Current History", "The Journal of Negro History", "FR Guerres", "PT História", "L'Illustration", "Lippincott's Magazine", "Animals-Wild-Reptiles and Amphibians", "PT Biografia", "Harper's Young People", "IT Letteratura per ragazzi", "McClure's Magazine", "Romantic Fiction", "De Aarde en haar Volken", "FR Beaux-Arts", "IT Teatro in prosa", "Birds, Illustrated by Color Photography", "FR Livres, Collections et Bibliophilie", "IT Viaggi", "The Mirror of Literature, Amusement, and Instruction", "IT Romanzi storici", "The American Missionary", "Famous Scots Series", "Illustrators", "FR Occultisme", "The Bay State Monthly", "The Nursery", "FR Droit et Justice", "IT Biografie", "St. Nicholas Magazine for Boys and Girls", "The Botanical Magazine", "Canon Law", "Chambers's Edinburgh Journal", "The Esperantist", "The Mentor", "Continental Monthly", "FR La Première Guerre Mondiale, 1914-1918", "The Great Round World And What Is Going On In It", "The Girls Own Paper", "Buchanan's Journal of Man", "Mycology", "Punchinello", "PT Política e Sociedade", "The Strand Magazine", "Spanish American War", "Microbiology", "Mother Earth", "Godey's Lady's Book", "IT Psicologia e Sociologia", "Northern Nut Growers Association", "FR Services publics", "PT Teatro", "PT Periódicos", "FR Chansons", "The Brochure Series of Architectural Illustration", "PT Navegações e Explorações", "IT Musica", "Graham's Magazine", "Golden Days for Boys and Girls", "IT Narrativa varia", "The Catholic World", "IT Teatro in versi", "IT Scienze politiche", "Little Folks", "The Scrap Book", "The Knickerbocker", "FR Littérature francophone", "FR Métiers et Artisanat", "IT Filosofia", "IT Linguistica", "PT Infantil e Juvenil", "IT Cucina", "IT Religione e Spiritualità", "Bulletin de Lille", "The Galaxy", "Maps and Cartography", "Prairie Farmer", "The Illustrated War News", "Celtic Magazine", "The Arena", "The Christian Foundation", "IT Geografia", "Noteworthy Trials(Bookshelf)", "Dew Drops", "PT Ciência e Técnica", "The Mirror of Taste, and Dramatic Censor", "The Yellow Book", "PT Arte", "The Irish Ecclesiastical Record", "The Philatelic Digital Library Project", "IT Folklore", "FR Sports et loisirs", "The American Bee Journal", "The Irish Penny Journal", "Ainslee's", "IT Umorismo", "Armour's Monthly Cook Book", "The Idler", "IT Botanica", "IT Scienza", "English Civil War", "The American Journal of Archaeology", "The Contemporary Review", "The Argosy", "Popular Science Monthly", "Garden and Forest", "Donahoe's Magazine", "The Economist", "Bird-Lore", "FR Prix Nobel", "Mrs Whittelsey's Magazine for Mothers and Daughters", "Poetry, A Magazine of Verse", "Barnavännen", "IT Legge", "IT Agraria", "FR Presse", "IT Numismatica", "IT Teatro dialettale", "Journal of Entomology and Zoology", "The Menorah Journal", "The Unpopular Review", "Our Young Folks", "The American Quarterly Review", "IT Archeologia e Storia dell'arte", "The Mayflower", "The Stars and Stripes", "PT Língua Portuguesa", "General Fiction", "Scribner's Magazine", "The American Architect and Building News", "IT Miscellanea", "The Writer", "IT Discorsi e Orazioni", "IT Architettura", "The Baptist Magazine", "The Aldine", "The National Preacher", "The North American Medical and Surgical Journal", "IT Scienze militari", "IT Tecnologia", "London Medical Gazette", "The Speaker", "IT Salute", "The Church of England Magazine", "IT Arte varia", "The Haslemere Museum Gazette", "IT Economia"];
const ENVIRONMENT_PRESETS = ["default", "contact", "egypt", "checkerboard", "forest", "goaland", "yavapai", "goldmine", "threetowers", "poison", "arches", "tron", "japan", "dream", "volcano", "starry", "osiris", "moon"];
const READING_COLORS = ["#edd1b0", "#eddd6e", "#f8fd89"];
const BOOK_TEXT_URL = "https://gutenberg-proxy.glitch.me";
const BOOK_META_URL = "https://gutendex.com/books/";
const PAGE_STATE_VALUES = { reading: "reading", browsing: "browsing" };
let PAGE_STATE = PAGE_STATE_VALUES.browsing;

function $(elmType, parent, attributes = {}) {
    let elm = document.createElement(elmType);
    (typeof parent == "string" ? document.querySelector(parent) : parent).append(elm);
    Object.entries(attributes).forEach(([prop, value]) => {
        elm.setAttribute(prop, value);
    });
    return elm;
}

function makeSafeForCSS(name) {
    return name.replace(/[^a-z0-9]/g, function (s) {
        var c = s.charCodeAt(0);
        if (c == 32) return '-';
        if (c >= 65 && c <= 90) return '_' + s.toLowerCase();
        return '__' + ('000' + c.toString(16)).slice(-4);
    });
}