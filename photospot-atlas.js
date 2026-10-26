document.addEventListener("DOMContentLoaded", () => {
    const rawSpots = Array.isArray(window.PHOTOSPOT_ATLAS_DATA) ? window.PHOTOSPOT_ATLAS_DATA : [];
    const spots = rawSpots.filter((spot) => (
        spot &&
        typeof spot.id === "string" &&
        typeof spot.title === "string" &&
        Array.isArray(spot.coordinates) &&
        spot.coordinates.length === 2 &&
        spot.coordinates.every(Number.isFinite)
    ));

    const elements = {
        svg: document.getElementById("world-map"),
        mapLoading: document.getElementById("map-loading"),
        mapError: document.getElementById("map-error"),
        retryMap: document.getElementById("retry-map"),
        filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
        search: document.getElementById("atlas-search"),
        spotList: document.getElementById("spot-list"),
        emptyState: document.getElementById("empty-state"),
        resultCount: document.getElementById("result-count"),
        atlasIndex: document.getElementById("atlas-index"),
        spotCount: document.getElementById("spot-count"),
        countryCount: document.getElementById("country-count"),
        continentCount: document.getElementById("continent-count"),
        spotNumber: document.getElementById("spot-number"),
        spotStatus: document.getElementById("spot-status"),
        spotVisualIndex: document.getElementById("spot-visual-index"),
        spotCategory: document.getElementById("spot-category"),
        spotTitle: document.getElementById("spot-title"),
        spotPlace: document.getElementById("spot-place"),
        spotNote: document.getElementById("spot-note"),
        spotLight: document.getElementById("spot-light"),
        spotSeason: document.getElementById("spot-season"),
        spotCoordinates: document.getElementById("spot-coordinates"),
        copyCoordinates: document.getElementById("copy-coordinates"),
        previousSpot: document.getElementById("previous-spot"),
        nextSpot: document.getElementById("next-spot"),
        panelIndex: document.getElementById("panel-index"),
        zoomIn: document.getElementById("zoom-in"),
        zoomOut: document.getElementById("zoom-out"),
        resetMap: document.getElementById("reset-map"),
        toast: document.getElementById("atlas-toast"),
    };

    const state = {
        filter: "all",
        query: "",
        selectedId: spots[0]?.id || null,
        projection: null,
        zoom: null,
        svgSelection: null,
        viewport: null,
        markerSelection: null,
        zoomScale: 1,
        toastTimer: null,
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const normalize = (value) => String(value || "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    function getVisibleSpots() {
        return spots.filter((spot) => {
            const matchesFilter = state.filter === "all" || spot.category === state.filter;
            const haystack = normalize([spot.title, spot.place, spot.country, spot.category, spot.note].join(" "));
            return matchesFilter && (!state.query || haystack.includes(state.query));
        });
    }

    function getSelectedSpot() {
        return spots.find((spot) => spot.id === state.selectedId) || null;
    }

    function padIndex(value) {
        return String(value).padStart(2, "0");
    }

    function displayCategory(value) {
        if (!value) return "Uncatalogued";
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function formatCoordinates(coordinates) {
        const [longitude, latitude] = coordinates;
        const latDirection = latitude >= 0 ? "N" : "S";
        const lonDirection = longitude >= 0 ? "E" : "W";
        return `${Math.abs(latitude).toFixed(4)}° ${latDirection}, ${Math.abs(longitude).toFixed(4)}° ${lonDirection}`;
    }

    function updateStats() {
        elements.spotCount.textContent = padIndex(spots.length);
        elements.countryCount.textContent = padIndex(new Set(spots.map((spot) => spot.country)).size);
        elements.continentCount.textContent = padIndex(new Set(spots.map((spot) => spot.continent)).size);
        elements.atlasIndex.textContent = `${padIndex(spots.length)} / ${padIndex(new Set(spots.map((spot) => spot.country)).size)}`;
    }

    function makeSpotCard(spot) {
        const sourceIndex = spots.findIndex((item) => item.id === spot.id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "spot-card";
        button.dataset.spotId = spot.id;
        button.setAttribute("aria-label", `Open ${spot.title}, ${spot.place}`);
        button.setAttribute("aria-pressed", String(spot.id === state.selectedId));
        if (spot.id === state.selectedId) button.classList.add("is-selected");

        const cardIndex = document.createElement("span");
        cardIndex.className = "spot-card-index";
        const number = document.createElement("span");
        number.textContent = `№ ${padIndex(sourceIndex + 1)}`;
        const category = document.createElement("span");
        category.className = "spot-card-category";
        category.textContent = displayCategory(spot.category);
        cardIndex.append(number, category);

        const title = document.createElement("h3");
        title.textContent = spot.title;
        const place = document.createElement("p");
        place.textContent = spot.place;
        button.append(cardIndex, title, place);

        button.addEventListener("click", () => {
            selectSpot(spot.id);
            flyToSpot(spot);
            document.getElementById("spot-panel")?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "nearest" });
        });
        return button;
    }

    function renderSpotList() {
        const visibleSpots = getVisibleSpots();
        elements.spotList.replaceChildren(...visibleSpots.map(makeSpotCard));
        elements.spotList.hidden = visibleSpots.length === 0;
        elements.emptyState.hidden = visibleSpots.length !== 0;
        elements.resultCount.textContent = visibleSpots.length === spots.length
            ? `Showing all ${spots.length} signals`
            : `${visibleSpots.length} signal${visibleSpots.length === 1 ? "" : "s"} in view`;
    }

    function updateMarkers() {
        if (!state.markerSelection) return;
        const visibleIds = new Set(getVisibleSpots().map((spot) => spot.id));
        state.markerSelection
            .classed("is-selected", (spot) => spot.id === state.selectedId)
            .classed("is-filtered", (spot) => !visibleIds.has(spot.id))
            .attr("aria-pressed", (spot) => String(spot.id === state.selectedId))
            .attr("aria-hidden", (spot) => String(!visibleIds.has(spot.id)))
            .attr("tabindex", (spot) => visibleIds.has(spot.id) ? 0 : -1);
    }

    function updateDetail() {
        const spot = getSelectedSpot();
        const visibleSpots = getVisibleSpots();
        const visibleIndex = visibleSpots.findIndex((item) => item.id === state.selectedId);
        const sourceIndex = spot ? spots.findIndex((item) => item.id === spot.id) : -1;

        if (!spot) {
            elements.spotNumber.textContent = "Spot 00";
            elements.spotStatus.textContent = "—";
            elements.panelIndex.textContent = `— / ${padIndex(visibleSpots.length)}`;
            elements.previousSpot.disabled = true;
            elements.nextSpot.disabled = true;
            return;
        }

        elements.spotNumber.textContent = `Spot ${padIndex(sourceIndex + 1)}`;
        elements.spotStatus.textContent = spot.status === "visited" ? "Captured" : "On the list";
        elements.spotVisualIndex.textContent = padIndex(sourceIndex + 1);
        elements.spotCategory.textContent = displayCategory(spot.category);
        elements.spotTitle.textContent = spot.title;
        elements.spotPlace.textContent = spot.place;
        elements.spotNote.textContent = spot.note || "Field note to be added.";
        elements.spotLight.textContent = spot.bestTime || "—";
        elements.spotSeason.textContent = spot.season || "—";
        elements.spotCoordinates.textContent = formatCoordinates(spot.coordinates);
        elements.copyCoordinates.disabled = false;
        elements.panelIndex.textContent = visibleIndex >= 0
            ? `${padIndex(visibleIndex + 1)} / ${padIndex(visibleSpots.length)}`
            : `— / ${padIndex(visibleSpots.length)}`;
        elements.previousSpot.disabled = visibleSpots.length < 2 || visibleIndex < 0;
        elements.nextSpot.disabled = visibleSpots.length < 2 || visibleIndex < 0;
    }

    function selectSpot(id) {
        if (!spots.some((spot) => spot.id === id)) return;
        state.selectedId = id;
        updateDetail();
        updateMarkers();
        document.querySelectorAll(".spot-card").forEach((card) => {
            const selected = card.dataset.spotId === id;
            card.classList.toggle("is-selected", selected);
            card.setAttribute("aria-pressed", String(selected));
        });
    }

    function selectAdjacent(direction) {
        const visibleSpots = getVisibleSpots();
        if (visibleSpots.length === 0) return;
        let currentIndex = visibleSpots.findIndex((spot) => spot.id === state.selectedId);
        if (currentIndex < 0) currentIndex = 0;
        const nextIndex = (currentIndex + direction + visibleSpots.length) % visibleSpots.length;
        const nextSpot = visibleSpots[nextIndex];
        selectSpot(nextSpot.id);
        flyToSpot(nextSpot);
    }

    function reconcileSelection() {
        const visibleSpots = getVisibleSpots();
        if (!visibleSpots.some((spot) => spot.id === state.selectedId)) {
            state.selectedId = visibleSpots[0]?.id || null;
        }
        renderSpotList();
        updateDetail();
        updateMarkers();
    }

    function updateMarkerTransforms(scale = state.zoomScale) {
        if (!state.markerSelection || !state.projection) return;
        state.markerSelection.attr("transform", (spot) => {
            const [x, y] = state.projection(spot.coordinates);
            return `translate(${x},${y}) scale(${1 / scale})`;
        });
    }

    function flyToSpot(spot) {
        if (!state.projection || !state.zoom || !state.svgSelection || !spot) return;
        const [x, y] = state.projection(spot.coordinates);
        const scale = Math.max(2.15, state.zoomScale);
        const transform = d3.zoomIdentity.translate(600, 310).scale(scale).translate(-x, -y);
        const target = reducedMotion.matches ? state.svgSelection : state.svgSelection.transition().duration(650).ease(d3.easeCubicOut);
        target.call(state.zoom.transform, transform);
    }

    function resetMap() {
        if (!state.zoom || !state.svgSelection) return;
        const target = reducedMotion.matches ? state.svgSelection : state.svgSelection.transition().duration(500).ease(d3.easeCubicOut);
        target.call(state.zoom.transform, d3.zoomIdentity);
    }

    function zoomBy(factor) {
        if (!state.zoom || !state.svgSelection) return;
        const target = reducedMotion.matches ? state.svgSelection : state.svgSelection.transition().duration(320).ease(d3.easeCubicOut);
        target.call(state.zoom.scaleBy, factor);
    }

    async function buildMap() {
        if (!window.d3 || !window.topojson) {
            showMapError();
            return;
        }

        elements.mapError.hidden = true;
        elements.mapLoading.classList.remove("is-hidden");

        try {
            const response = await fetch("assets/map-data/countries-110m.json", { cache: "force-cache" });
            if (!response.ok) throw new Error(`Map request failed with ${response.status}`);
            const world = await response.json();
            const countries = topojson.feature(world, world.objects.countries);
            const borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);

            const svg = d3.select(elements.svg);
            svg.selectAll(".map-rendered-layer").remove();
            const projection = d3.geoNaturalEarth1().fitExtent([[38, 42], [1162, 578]], { type: "Sphere" });
            const path = d3.geoPath(projection);
            const viewport = svg.append("g").attr("class", "map-rendered-layer");

            viewport.append("path").datum({ type: "Sphere" }).attr("class", "map-sphere").attr("d", path);
            viewport.append("path").datum(d3.geoGraticule10()).attr("class", "map-graticule").attr("d", path);
            viewport.append("path").datum(countries).attr("class", "map-land").attr("d", path);
            viewport.append("path").datum(borders).attr("class", "map-borders").attr("d", path);

            const markerSelection = viewport.append("g")
                .attr("class", "map-markers")
                .selectAll("g")
                .data(spots, (spot) => spot.id)
                .join("g")
                .attr("class", "spot-marker")
                .attr("role", "button")
                .attr("tabindex", 0)
                .attr("aria-label", (spot) => `${spot.title}, ${spot.place}`)
                .on("click", (event, spot) => {
                    event.stopPropagation();
                    selectSpot(spot.id);
                })
                .on("keydown", (event, spot) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectSpot(spot.id);
                    }
                });

            markerSelection.append("circle").attr("class", "marker-hit").attr("r", 21);
            markerSelection.append("circle").attr("class", "marker-pulse").attr("r", 10);
            markerSelection.append("circle").attr("class", "marker-ring").attr("r", 10);
            markerSelection.append("circle").attr("class", "marker-core").attr("r", 4.3);
            markerSelection.append("text").attr("class", "marker-label").attr("x", 15).attr("y", 4).text((spot) => spot.place.split(",")[0]);

            const zoom = d3.zoom()
                .scaleExtent([1, 6])
                .translateExtent([[-80, -80], [1280, 700]])
                .extent([[0, 0], [1200, 620]])
                .on("zoom", (event) => {
                    state.zoomScale = event.transform.k;
                    viewport.attr("transform", event.transform);
                    updateMarkerTransforms(event.transform.k);
                });

            svg.call(zoom).on("dblclick.zoom", null);
            state.projection = projection;
            state.zoom = zoom;
            state.svgSelection = svg;
            state.viewport = viewport;
            state.markerSelection = markerSelection;
            state.zoomScale = 1;
            updateMarkerTransforms(1);
            updateMarkers();
            elements.mapLoading.classList.add("is-hidden");
        } catch (error) {
            console.error("Photospot atlas could not be drawn:", error);
            showMapError();
        }
    }

    function showMapError() {
        elements.mapLoading.classList.add("is-hidden");
        elements.mapError.hidden = false;
    }

    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.add("is-visible");
        window.clearTimeout(state.toastTimer);
        state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 1800);
    }

    async function copySelectedCoordinates() {
        const spot = getSelectedSpot();
        if (!spot) return;
        const value = `${spot.coordinates[1]}, ${spot.coordinates[0]}`;
        try {
            await navigator.clipboard.writeText(value);
        } catch (error) {
            const textarea = document.createElement("textarea");
            textarea.value = value;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
        }
        showToast("Coordinates copied");
    }

    function bindEvents() {
        elements.filterButtons.forEach((button) => {
            button.addEventListener("click", () => {
                state.filter = button.dataset.filter;
                elements.filterButtons.forEach((item) => {
                    const active = item === button;
                    item.classList.toggle("is-active", active);
                    item.setAttribute("aria-pressed", String(active));
                });
                reconcileSelection();
            });
        });

        elements.search.addEventListener("input", () => {
            state.query = normalize(elements.search.value.trim());
            reconcileSelection();
        });
        elements.previousSpot.addEventListener("click", () => selectAdjacent(-1));
        elements.nextSpot.addEventListener("click", () => selectAdjacent(1));
        elements.copyCoordinates.addEventListener("click", copySelectedCoordinates);
        elements.zoomIn.addEventListener("click", () => zoomBy(1.45));
        elements.zoomOut.addEventListener("click", () => zoomBy(1 / 1.45));
        elements.resetMap.addEventListener("click", resetMap);
        elements.retryMap.addEventListener("click", buildMap);

        document.addEventListener("keydown", (event) => {
            const tagName = document.activeElement?.tagName;
            const typing = tagName === "INPUT" || tagName === "TEXTAREA";
            if (event.key === "/" && !typing) {
                event.preventDefault();
                elements.search.focus();
            }
            if (event.key === "Escape" && document.activeElement === elements.search && elements.search.value) {
                elements.search.value = "";
                state.query = "";
                reconcileSelection();
            }
        });
    }

    updateStats();
    renderSpotList();
    updateDetail();
    bindEvents();
    buildMap();
});
