const CAL_EMBED_URL = "https://app.cal.com/embed/embed.js";
const CAL_ORIGIN = "https://app.cal.com";
const THREE_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const GOOGLE_ANALYTICS_SCRIPT_URL = "https://www.googletagmanager.com/gtag/js";
const COOKIE_CONSENT_KEY = "ywm-cookie-consent-v1";
const RESUME_ACCESS_SESSION_KEY = "ywm-resume-access-name-v1";
const GA_MEASUREMENT_ID_PLACEHOLDER = "G-XXXXXXXXXX";
const COOKIE_CONSENT_VALUES = Object.freeze({
    essential: "essential",
    analytics: "analytics",
    embedded: "embedded",
});

document.addEventListener("DOMContentLoaded", () => {
    const App = {
        consentValue: null,
        analyticsMeasurementId: null,
        analyticsReadyPromise: null,
        analyticsConfigured: false,
        calReadyPromise: null,
        calConfiguredNamespaces: new Set(),
        threeReadyPromise: null,
        scene: null,
        camera: null,
        renderer: null,
        particles: null,
        particleGeometry: null,
        particleMaterial: null,
        animationFrameId: null,
        threeClock: null,
        threeMouse: { x: 0, y: 0 },
        prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)"),

        elements: {
            loader: document.getElementById("loader"),
            mainContent: document.querySelector("main"),
            header: document.getElementById("main-header"),
            heroSection: document.getElementById("top"),
            countUpValues: Array.from(document.querySelectorAll("[data-count-up]")),
            resumeCaptures: Array.from(document.querySelectorAll("[data-resume-capture]")),
            backToTopButton: document.getElementById("back-to-top"),
            progressBar: document.getElementById("progress-bar"),
            mobileMenu: document.getElementById("mobile-menu"),
            openMenuBtn: document.getElementById("open-menu-btn"),
            closeMenuBtn: document.getElementById("close-menu-btn"),
            footerCookieSettingsButton: document.getElementById("open-cookie-settings"),
            cookieBanner: document.getElementById("cookie-banner"),
            cookieChoiceButtons: Array.from(document.querySelectorAll("[data-cookie-choice]")),
            bookingLinks: Array.from(document.querySelectorAll("[data-cal-link]")),
            copyButtons: Array.from(document.querySelectorAll("[data-copy-text]")),
            threeCanvas: document.getElementById("three-canvas"),
            sections: Array.from(document.querySelectorAll("main section[id]")),
            resumeAccessGate: document.getElementById("resume-access-gate"),
            resumeAccessForm: document.getElementById("resume-access-form"),
            resumeAccessInput: document.getElementById("resume-access-name"),
            resumeAccessSubmit: document.getElementById("resume-access-submit"),
            resumeAccessStatus: document.getElementById("resume-access-status"),
            resumeGreetingBanner: document.getElementById("resume-greeting-banner"),
            resumeGreetingText: document.getElementById("resume-greeting-text"),
            scrollPrompt: document.getElementById("scroll-prompt"),
        },

        init() {
            this.analyticsMeasurementId = this.getAnalyticsMeasurementId();
            this.initImageFallbacks();
            this.initCookieConsent();
            this.initResumeAccessGate();
            this.initCountUpValues();
            this.initLoader();
            this.initThreeJS().then(() => {
                this.startAnimation();
            }).catch((error) => {
                console.error("Three.js setup failed:", error);
            });
            this.initPointerTracking();
            this.initScrollAnimations();
            this.initHeader();
            this.initBackToTopButton();
            this.initMobileMenu();
            this.initNavLinksSmoothScroll();
            this.initBookingLinks();
            this.initCopyButtons();
            this.initResumeCaptures();
            this.initKeyboardShortcuts();
            this.addEventListeners();
            this.updateScrollState();
        },

        initImageFallbacks() {
            document.querySelectorAll("img[data-fallback-src]").forEach((image) => {
                const fallbackSrc = image.dataset.fallbackSrc;
                if (!fallbackSrc) return;

                const handleError = () => {
                    if (image.dataset.fallbackApplied === "true") return;
                    image.dataset.fallbackApplied = "true";
                    image.src = fallbackSrc;
                };

                image.addEventListener("error", handleError, { once: true });

                if (image.complete && image.naturalWidth === 0) {
                    handleError();
                }
            });
        },

        getAnalyticsMeasurementId() {
            const configuredId = window.YWM_SITE_CONFIG?.gaMeasurementId?.trim() || "";
            return this.hasValidAnalyticsMeasurementId(configuredId) ? configuredId.toUpperCase() : "";
        },

        hasValidAnalyticsMeasurementId(value) {
            return (
                typeof value === "string" &&
                /^G-[A-Z0-9]+$/i.test(value.trim()) &&
                value.trim().toUpperCase() !== GA_MEASUREMENT_ID_PLACEHOLDER
            );
        },

        isAnalyticsConsentGranted() {
            return (
                this.consentValue === COOKIE_CONSENT_VALUES.analytics ||
                this.consentValue === COOKIE_CONSENT_VALUES.embedded
            );
        },

        loadAnalyticsScript() {
            const existingScript = document.querySelector('script[data-google-analytics="true"]');
            if (existingScript?.dataset.loaded === "true") {
                return Promise.resolve();
            }

            if (this.analyticsReadyPromise) {
                return this.analyticsReadyPromise;
            }

            this.analyticsReadyPromise = new Promise((resolve, reject) => {
                const analyticsScript = document.querySelector('script[data-google-analytics="true"]');

                const handleLoad = () => {
                    if (analyticsScript) analyticsScript.dataset.loaded = "true";
                    resolve();
                };

                const handleError = () => {
                    this.analyticsReadyPromise = null;
                    reject(new Error("Google Analytics script failed to load."));
                };

                if (analyticsScript?.dataset.loaded === "true") {
                    resolve();
                    return;
                }

                if (analyticsScript) {
                    analyticsScript.addEventListener("load", handleLoad, { once: true });
                    analyticsScript.addEventListener("error", handleError, { once: true });
                    return;
                }

                const script = document.createElement("script");
                script.src = `${GOOGLE_ANALYTICS_SCRIPT_URL}?id=${encodeURIComponent(this.analyticsMeasurementId)}`;
                script.async = true;
                script.dataset.googleAnalytics = "true";
                script.addEventListener("load", () => {
                    script.dataset.loaded = "true";
                    handleLoad();
                }, { once: true });
                script.addEventListener("error", handleError, { once: true });
                document.head.appendChild(script);
            });

            return this.analyticsReadyPromise;
        },

        enableAnalytics() {
            if (!this.analyticsMeasurementId) {
                return Promise.resolve(false);
            }

            const disableKey = `ga-disable-${this.analyticsMeasurementId}`;
            window[disableKey] = false;
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function gtag() {
                window.dataLayer.push(arguments);
            };
            window.gtag("consent", "default", {
                analytics_storage: "denied",
                ad_storage: "denied",
                ad_user_data: "denied",
                ad_personalization: "denied",
            });

            return this.loadAnalyticsScript()
                .then(() => {
                    if (!this.analyticsConfigured) {
                        window.gtag("js", new Date());
                    }

                    window.gtag("consent", "update", {
                        analytics_storage: "granted",
                        ad_storage: "denied",
                        ad_user_data: "denied",
                        ad_personalization: "denied",
                    });

                    if (!this.analyticsConfigured) {
                        window.gtag("config", this.analyticsMeasurementId, {
                            anonymize_ip: true,
                            transport_type: "beacon",
                        });
                        this.analyticsConfigured = true;
                    }

                    return true;
                })
                .catch((error) => {
                    this.analyticsReadyPromise = null;
                    console.error("Google Analytics failed to load:", error);
                    return false;
                });
        },

        disableAnalytics() {
            if (!this.analyticsMeasurementId) return;

            window[`ga-disable-${this.analyticsMeasurementId}`] = true;

            if (typeof window.gtag !== "function") return;

            window.gtag("consent", "update", {
                analytics_storage: "denied",
                ad_storage: "denied",
                ad_user_data: "denied",
                ad_personalization: "denied",
            });
        },

        trackEvent(eventName, params = {}) {
            if (!this.analyticsMeasurementId || !this.isAnalyticsConsentGranted() || typeof window.gtag !== "function") {
                return;
            }

            window.gtag("event", eventName, {
                page_location: window.location.href,
                page_path: window.location.pathname,
                page_title: document.title,
                ...params,
            });
        },

        getLinkLabel(link) {
            return (link?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
        },

        trackStrategyCall(link, interactionSource = "click") {
            this.trackEvent("generate_lead", {
                lead_type: "strategy_call",
                engagement_type: "booking",
                interaction_source: interactionSource,
                link_text: this.getLinkLabel(link),
                link_url: this.getBookingUrl(link) || link?.href || "",
            });
        },

        isPdfLink(url) {
            if (!url) return false;

            try {
                const parsedUrl = new URL(url, window.location.origin);
                return parsedUrl.pathname.toLowerCase().endsWith(".pdf");
            } catch (error) {
                return false;
            }
        },

        trackLinkInteraction(link) {
            const href = link?.getAttribute("href")?.trim() || "";
            if (!href) return;

            if (href.startsWith("mailto:")) {
                this.trackEvent("generate_lead", {
                    lead_type: "email_contact",
                    engagement_type: "email_click",
                    link_text: this.getLinkLabel(link),
                    link_url: link.href,
                });
                return;
            }

            if (href.startsWith("tel:")) {
                this.trackEvent("generate_lead", {
                    lead_type: "phone_contact",
                    engagement_type: "phone_click",
                    link_text: this.getLinkLabel(link),
                    link_url: link.href,
                });
                return;
            }

            if (!this.isPdfLink(link.href || href)) return;

            let fileName = "download.pdf";
            try {
                const parsedUrl = new URL(link.href || href, window.location.origin);
                fileName = parsedUrl.pathname.split("/").filter(Boolean).pop() || fileName;
            } catch (error) {
                fileName = href.split("/").filter(Boolean).pop() || fileName;
            }

            this.trackEvent("file_download", {
                file_name: fileName,
                file_extension: "pdf",
                link_text: this.getLinkLabel(link),
                link_url: link.href || href,
            });
        },

        initResumeAccessGate() {
            const gate = this.elements.resumeAccessGate;
            const form = this.elements.resumeAccessForm;
            const input = this.elements.resumeAccessInput;
            const submit = this.elements.resumeAccessSubmit;
            const status = this.elements.resumeAccessStatus;

            if (!gate || !form || !input || !submit || !status) return;

            const storedVisitorName = this.getStoredResumeVisitorName();
            if (storedVisitorName) {
                this.unlockResumeAccess(storedVisitorName, { immediate: true });
                return;
            }

            form.addEventListener("submit", async (event) => {
                event.preventDefault();

                if (gate.dataset.submitting === "true") return;
                if (!input.reportValidity()) return;

                const visitorName = input.value.trim().replace(/\s+/g, " ");
                if (!visitorName) return;

                gate.dataset.submitting = "true";
                gate.classList.remove("has-error");
                input.disabled = true;
                submit.disabled = true;
                submit.textContent = "Opening";
                status.textContent = "Registering your access...";

                try {
                    await this.submitResumeAccess(visitorName);
                    this.storeResumeVisitorName(visitorName);
                    this.unlockResumeAccess(visitorName);
                } catch (error) {
                    console.error("Resume access registration failed:", error);
                    gate.classList.add("has-error");
                    status.textContent = "Access could not be registered. Please try again.";
                    input.disabled = false;
                    submit.disabled = false;
                    submit.textContent = "Reveal resume";
                    input.focus({ preventScroll: true });
                } finally {
                    delete gate.dataset.submitting;
                }
            });
        },

        getStoredResumeVisitorName() {
            try {
                const storedName = window.sessionStorage.getItem(RESUME_ACCESS_SESSION_KEY);
                return storedName ? storedName.trim() : "";
            } catch (error) {
                console.warn("Resume access name could not be read:", error);
                return "";
            }
        },

        storeResumeVisitorName(name) {
            try {
                window.sessionStorage.setItem(RESUME_ACCESS_SESSION_KEY, name);
            } catch (error) {
                console.warn("Resume access name could not be stored:", error);
            }
        },

        async submitResumeAccess(name) {
            const gate = this.elements.resumeAccessGate;
            const endpoint = gate?.dataset.formspreeEndpoint;

            if (!endpoint) {
                throw new Error("Missing Formspree endpoint.");
            }

            const response = await window.fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    name,
                    visitor_name: name,
                    _subject: "Resume page access from website",
                    source: "hidden_resume_gate",
                    requested_asset: "digital_resume",
                    page_url: window.location.href,
                    page_title: document.title,
                    submitted_at: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                throw new Error(`Formspree request failed with status ${response.status}.`);
            }

            const responseBody = await response.json().catch(() => ({}));
            if (responseBody?.ok === false) {
                throw new Error("Formspree rejected the submission.");
            }
        },

        unlockResumeAccess(name, { immediate = false } = {}) {
            const gate = this.elements.resumeAccessGate;
            const input = this.elements.resumeAccessInput;
            const submit = this.elements.resumeAccessSubmit;
            const status = this.elements.resumeAccessStatus;
            const greetingBanner = this.elements.resumeGreetingBanner;
            const greetingText = this.elements.resumeGreetingText;

            if (greetingText) {
                greetingText.textContent = `Hi ${name}, welcome...`;
            }

            if (greetingBanner) {
                greetingBanner.hidden = false;
                if (immediate) {
                    greetingBanner.classList.add("is-visible");
                } else {
                    window.requestAnimationFrame(() => {
                        greetingBanner.classList.add("is-visible");
                    });
                }
            }

            document.body.classList.remove("resume-gate-active");
            status.textContent = "";
            if (input) input.disabled = false;
            if (submit) {
                submit.disabled = false;
                submit.textContent = "Reveal resume";
            }

            if (immediate) {
                gate?.classList.add("is-hidden");
                gate?.setAttribute("hidden", "true");
                return;
            }

            gate?.classList.add("is-hidden");
            window.setTimeout(() => {
                gate?.setAttribute("hidden", "true");
            }, 420);
        },

        initCountUpValues() {
            this.elements.countUpValues.forEach((element) => {
                const targetValue = Number.parseInt(element.dataset.countTarget || "", 10);
                if (Number.isNaN(targetValue)) return;

                element.dataset.countAnimated = "false";
                element.textContent = this.formatCountValue(0, element.dataset.countSuffix || "");
            });
        },

        formatCountValue(value, suffix = "") {
            return `${value}${suffix}`;
        },

        animateCountValue(element, index = 0) {
            if (!element || element.dataset.countAnimated === "true") return;

            const targetValue = Number.parseInt(element.dataset.countTarget || "", 10);
            if (Number.isNaN(targetValue)) return;

            const suffix = element.dataset.countSuffix || "";

            if (this.prefersReducedMotion.matches) {
                element.textContent = this.formatCountValue(targetValue, suffix);
                element.dataset.countAnimated = "true";
                return;
            }

            const duration = 1850;
            const delay = index * 160;
            const startTime = window.performance.now() + delay;

            const easeInOutCubic = (progress) => (
                progress < 0.5
                    ? 4 * progress * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2
            );

            const step = (now) => {
                if (now < startTime) {
                    window.requestAnimationFrame(step);
                    return;
                }

                const progress = Math.min((now - startTime) / duration, 1);
                const easedProgress = easeInOutCubic(progress);
                const currentValue = Math.round(targetValue * easedProgress);

                element.textContent = this.formatCountValue(currentValue, suffix);

                if (progress < 1) {
                    window.requestAnimationFrame(step);
                    return;
                }

                element.textContent = this.formatCountValue(targetValue, suffix);
                element.dataset.countAnimated = "true";
            };

            window.requestAnimationFrame(step);
        },

        startCountUpAnimations() {
            this.elements.countUpValues.forEach((element, index) => {
                this.animateCountValue(element, index);
            });
        },

        initCookieConsent() {
            this.consentValue = this.getStoredCookieConsent();

            this.elements.cookieChoiceButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    this.setCookieConsent(button.dataset.cookieChoice);
                });
            });

            this.elements.footerCookieSettingsButton?.addEventListener("click", () => {
                this.showCookieBanner();
            });

            if (!this.consentValue) {
                this.showCookieBanner();
                this.disableAnalytics();
                return;
            }

            this.hideCookieBanner({ immediate: true });
            this.applyConsentSelection(this.consentValue);
        },

        getStoredCookieConsent() {
            try {
                const storedValue = window.localStorage.getItem(COOKIE_CONSENT_KEY);
                return Object.values(COOKIE_CONSENT_VALUES).includes(storedValue) ? storedValue : null;
            } catch (error) {
                console.warn("Cookie consent could not be read:", error);
                return null;
            }
        },

        setCookieConsent(value) {
            if (!Object.values(COOKIE_CONSENT_VALUES).includes(value)) return;

            this.consentValue = value;

            try {
                window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
            } catch (error) {
                console.warn("Cookie consent could not be stored:", error);
            }

            this.hideCookieBanner();
            this.applyConsentSelection(value);
        },

        applyConsentSelection(value) {
            if (value === COOKIE_CONSENT_VALUES.essential) {
                this.disableAnalytics();
                return;
            }

            this.enableAnalytics();

            if (value === COOKIE_CONSENT_VALUES.embedded) {
                this.enableEmbeddedScheduling();
            }
        },

        showCookieBanner() {
            if (!this.elements.cookieBanner) return;

            this.elements.cookieBanner.hidden = false;
            document.body.classList.add("cookie-banner-visible");
            window.requestAnimationFrame(() => {
                this.elements.cookieBanner?.classList.add("is-visible");
            });
        },

        hideCookieBanner({ immediate = false } = {}) {
            if (!this.elements.cookieBanner) return;

            const banner = this.elements.cookieBanner;
            document.body.classList.remove("cookie-banner-visible");

            if (immediate) {
                banner.classList.remove("is-visible");
                banner.hidden = true;
                return;
            }

            banner.classList.remove("is-visible");
            window.setTimeout(() => {
                if (!banner.classList.contains("is-visible")) {
                    banner.hidden = true;
                }
            }, 320);
        },

        initBookingLinks() {
            this.elements.bookingLinks.forEach((link) => {
                link.setAttribute("rel", "noopener noreferrer");
                link.setAttribute("target", "_blank");

                link.addEventListener("click", (event) => {
                    if (link.dataset.calBypass === "true") {
                        link.dataset.calBypass = "false";
                        return;
                    }

                    this.trackStrategyCall(link);

                    if (this.consentValue !== COOKIE_CONSENT_VALUES.embedded) {
                        return;
                    }

                    event.preventDefault();
                    this.openEmbeddedBooking(link);
                });
            });
        },

        initCopyButtons() {
            this.elements.copyButtons.forEach((button) => {
                const defaultLabel = button.dataset.copyLabelDefault || button.textContent.trim() || "Copy";
                const successLabel = button.dataset.copyLabelSuccess || "Copied";
                button.dataset.copyLabelDefault = defaultLabel;
                button.dataset.copyLabelSuccess = successLabel;

                button.addEventListener("click", async () => {
                    const text = button.dataset.copyText || "";
                    if (!text) return;

                    try {
                        await this.copyTextToClipboard(text);
                        button.textContent = successLabel;
                        button.classList.add("is-copied");
                        window.clearTimeout(button._copyResetTimeout);
                        button._copyResetTimeout = window.setTimeout(() => {
                            button.textContent = defaultLabel;
                            button.classList.remove("is-copied");
                        }, 1800);
                    } catch (error) {
                        console.error("Copy to clipboard failed:", error);
                        button.textContent = "Copy failed";
                        window.clearTimeout(button._copyResetTimeout);
                        button._copyResetTimeout = window.setTimeout(() => {
                            button.textContent = defaultLabel;
                        }, 1800);
                    }
                });
            });
        },

        async copyTextToClipboard(text) {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }

            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "absolute";
            textarea.style.left = "-9999px";
            document.body.appendChild(textarea);
            textarea.select();
            const wasCopied = document.execCommand("copy");
            document.body.removeChild(textarea);

            if (!wasCopied) {
                throw new Error("Clipboard copy command failed.");
            }
        },

        initResumeCaptures() {
            this.elements.resumeCaptures.forEach((capture) => {
                const trigger = capture.querySelector("[data-resume-trigger]");
                const form = capture.querySelector("[data-resume-form]");
                const input = capture.querySelector(".resume-capture-input");
                const submitButton = capture.querySelector("[data-resume-submit]");
                const closeButton = capture.querySelector("[data-resume-close]");

                if (!trigger || !form || !input || !submitButton) return;

                const defaultSubmitLabel = submitButton.textContent.trim();
                const defaultPlaceholder = input.getAttribute("placeholder") || "";
                capture.dataset.defaultSubmitLabel = defaultSubmitLabel;
                capture.dataset.defaultPlaceholder = defaultPlaceholder;

                trigger.addEventListener("click", (event) => {
                    event.preventDefault();

                    if (capture.classList.contains("is-open")) {
                        input.focus({ preventScroll: true });
                        return;
                    }

                    this.closeResumeCaptures(capture);
                    capture.classList.add("is-open");
                    capture.classList.remove("is-success", "has-error", "is-busy");
                    trigger.setAttribute("aria-expanded", "true");
                    submitButton.textContent = defaultSubmitLabel;
                    input.placeholder = defaultPlaceholder;
                    window.setTimeout(() => {
                        input.focus({ preventScroll: true });
                    }, 180);
                });

                closeButton?.addEventListener("click", () => {
                    this.resetResumeCapture(capture);
                });

                form.addEventListener("submit", async (event) => {
                    event.preventDefault();

                    if (capture.dataset.submitting === "true") return;
                    if (!input.reportValidity()) return;

                    capture.dataset.submitting = "true";
                    capture.classList.remove("has-error", "is-success");
                    capture.classList.add("is-open", "is-busy");
                    input.disabled = true;
                    submitButton.disabled = true;
                    closeButton?.setAttribute("disabled", "true");
                    submitButton.textContent = "Sending";

                    try {
                        await this.submitResumeCapture(capture, input.value.trim());

                        capture.classList.remove("is-busy", "has-error");
                        capture.classList.add("is-success");
                        input.value = "";
                        input.placeholder = "Check inbox";
                        submitButton.textContent = "Sent";

                        window.setTimeout(() => {
                            this.resetResumeCapture(capture);
                        }, 2200);
                    } catch (error) {
                        console.error("Resume capture submission failed:", error);
                        capture.classList.remove("is-busy", "is-success");
                        capture.classList.add("has-error", "is-open");
                        input.disabled = false;
                        submitButton.disabled = false;
                        closeButton?.removeAttribute("disabled");
                        submitButton.textContent = defaultSubmitLabel;
                        input.setCustomValidity("Submission failed. Please try again or email directly.");
                        input.reportValidity();
                        input.setCustomValidity("");
                        input.focus({ preventScroll: true });
                    } finally {
                        delete capture.dataset.submitting;
                    }
                });

                input.addEventListener("keydown", (event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        this.resetResumeCapture(capture);
                        trigger.focus({ preventScroll: true });
                    }
                });
            });
        },

        closeResumeCaptures(exceptCapture = null) {
            this.elements.resumeCaptures.forEach((capture) => {
                if (capture === exceptCapture) return;
                if (capture.dataset.submitting === "true") return;
                this.resetResumeCapture(capture);
            });
        },

        resetResumeCapture(capture) {
            if (!capture) return;
            if (capture.dataset.submitting === "true") return;

            const trigger = capture.querySelector("[data-resume-trigger]");
            const form = capture.querySelector("[data-resume-form]");
            const input = capture.querySelector(".resume-capture-input");
            const submitButton = capture.querySelector("[data-resume-submit]");
            const closeButton = capture.querySelector("[data-resume-close]");
            const defaultSubmitLabel = capture.dataset.defaultSubmitLabel || "Open";
            const defaultPlaceholder = capture.dataset.defaultPlaceholder || "Your email";

            capture.classList.remove("is-open", "is-success", "has-error", "is-busy");
            trigger?.setAttribute("aria-expanded", "false");
            if (form) form.reset();
            if (input) {
                input.disabled = false;
                input.placeholder = defaultPlaceholder;
            }
            if (submitButton) submitButton.textContent = defaultSubmitLabel;
            if (submitButton) submitButton.disabled = false;
            closeButton?.removeAttribute("disabled");
        },

        async submitResumeCapture(capture, email) {
            const endpoint = capture.dataset.formspreeEndpoint;
            if (!endpoint) {
                throw new Error("Missing Formspree endpoint.");
            }

            const source = capture.dataset.resumeSource || "website";
            const resumeUrl = capture.dataset.resumeUrl || "";
            const response = await window.fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    email,
                    _replyto: email,
                    _subject: "Resume request from website",
                    source,
                    requested_asset: "resume",
                    resume_url: resumeUrl,
                    page_url: window.location.href,
                    page_title: document.title,
                    submitted_at: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                throw new Error(`Formspree request failed with status ${response.status}.`);
            }

            const responseBody = await response.json().catch(() => ({}));
            if (responseBody?.ok === false) {
                throw new Error("Formspree rejected the submission.");
            }

            this.trackEvent("generate_lead", {
                lead_type: "resume_request",
                engagement_type: "resume_capture",
                resume_source: source,
                requested_asset: "resume",
                link_url: resumeUrl,
            });
        },

        getBookingUrl(link) {
            const calPath = link?.dataset.calLink;
            return calPath ? `https://cal.com/${calPath}` : link?.href || null;
        },

        getCalConfig(link) {
            try {
                return JSON.parse(link?.dataset.calConfig || "{}");
            } catch (error) {
                console.warn("Cal config could not be parsed:", error);
                return { theme: "dark", layout: "month_view" };
            }
        },

        loadCalEmbedScript() {
            if (typeof window.Cal === "function") {
                return Promise.resolve();
            }

            if (this.calReadyPromise) {
                return this.calReadyPromise;
            }

            this.calReadyPromise = new Promise((resolve, reject) => {
                const existingScript = document.querySelector('script[data-cal-embed="true"]');

                const handleLoad = () => {
                    if (typeof window.Cal === "function") {
                        resolve();
                        return;
                    }

                    this.calReadyPromise = null;
                    reject(new Error("Cal embed did not initialize correctly."));
                };

                const handleError = () => {
                    this.calReadyPromise = null;
                    reject(new Error("Cal embed failed to load."));
                };

                if (existingScript) {
                    existingScript.addEventListener("load", handleLoad, { once: true });
                    existingScript.addEventListener("error", handleError, { once: true });
                    return;
                }

                const script = document.createElement("script");
                script.src = CAL_EMBED_URL;
                script.async = true;
                script.defer = true;
                script.dataset.calEmbed = "true";
                script.addEventListener("load", handleLoad, { once: true });
                script.addEventListener("error", handleError, { once: true });
                document.head.appendChild(script);
            });

            return this.calReadyPromise;
        },

        enableEmbeddedScheduling() {
            const seedLink = this.elements.bookingLinks[0];
            if (!seedLink) return Promise.resolve();

            return this.loadCalEmbedScript().then(() => {
                const namespace = seedLink.dataset.calNamespace || "15min";
                if (this.calConfiguredNamespaces.has(namespace)) return;

                const calConfig = this.getCalConfig(seedLink);
                window.Cal("init", namespace, { origin: CAL_ORIGIN });

                if (window.Cal.ns && typeof window.Cal.ns[namespace] === "function") {
                    window.Cal.ns[namespace]("ui", {
                        hideEventTypeDetails: false,
                        ...calConfig,
                    });
                }

                this.calConfiguredNamespaces.add(namespace);
            });
        },

        openEmbeddedBooking(link) {
            const fallbackUrl = this.getBookingUrl(link);

            this.enableEmbeddedScheduling()
                .then(() => {
                    link.dataset.calBypass = "true";
                    link.click();
                })
                .catch((error) => {
                    console.error("Embedded booking launch failed:", error);
                    if (fallbackUrl) {
                        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
                    }
                });
        },

        triggerPrimaryBooking() {
            const primaryBookingLink = this.elements.bookingLinks[0];
            if (!primaryBookingLink) return;

            this.trackStrategyCall(primaryBookingLink, "keyboard_shortcut");

            if (this.consentValue === COOKIE_CONSENT_VALUES.embedded) {
                this.openEmbeddedBooking(primaryBookingLink);
                return;
            }

            const fallbackUrl = this.getBookingUrl(primaryBookingLink);
            if (fallbackUrl) {
                window.open(fallbackUrl, "_blank", "noopener,noreferrer");
            }
        },

        initLoader() {
            const loaderGreeting = document.getElementById("loader-greeting");
            const loaderTextContainer = document.getElementById("loader-text-container");
            if (!loaderGreeting || !this.elements.loader || !this.elements.mainContent || !loaderTextContainer) return;

            // Multilingual greetings matching the 4 languages on the credentials section
            const greetings = ["Hello", "Bonjour", "Hallo", "مرحبا"];
            let greetingIndex = 0;

            loaderGreeting.textContent = greetings[0];
            setTimeout(() => {
                loaderTextContainer.style.opacity = "1";
            }, 180);

            // Cycle greetings with a smooth fade
            const cycleInterval = setInterval(() => {
                greetingIndex = (greetingIndex + 1) % greetings.length;
                loaderGreeting.classList.add("fading");
                setTimeout(() => {
                    loaderGreeting.textContent = greetings[greetingIndex];
                    loaderGreeting.classList.remove("fading");
                }, 220);
            }, 520);

            // Slightly longer min-time so visitors see at least 2 languages cycle
            const minLoaderTime = 1500;
            let minTimePassed = false;
            let isWindowLoaded = false;

            const hideLoader = () => {
                if (this.elements.loader.classList.contains("hidden")) return;
                clearInterval(cycleInterval);
                document.body.classList.add("loaded");
                this.elements.loader.classList.add("hidden");
                this.elements.mainContent.classList.add("loaded");
                this.startCountUpAnimations();
                setTimeout(() => {
                    if (this.elements.loader) this.elements.loader.style.display = "none";
                }, 600);
            };

            setTimeout(() => {
                minTimePassed = true;
                if (isWindowLoaded) hideLoader();
            }, minLoaderTime);

            window.addEventListener("load", () => {
                isWindowLoaded = true;
                if (minTimePassed) hideLoader();
            });
        },

        initPointerTracking() {
            window.addEventListener("mousemove", (event) => {
                this.threeMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                this.threeMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            });
        },

        initScrollAnimations() {
            const scrollElements = document.querySelectorAll(".animate-on-scroll");
            if (scrollElements.length === 0) return;

            const scrollObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    entry.target.classList.add("is-visible");

                    if (entry.target.id === "values-pills-container") {
                        entry.target.querySelectorAll(".value-pill").forEach((pill, index) => {
                            setTimeout(() => pill.classList.add("is-visible"), index * 100);
                        });
                    }

                    scrollObserver.unobserve(entry.target);
                });
            }, { root: null, threshold: 0.18 });

            scrollElements.forEach((element) => scrollObserver.observe(element));
        },

        initHeader() {
            if (!this.elements.header) return;
            this.elements.header.classList.toggle("scrolled", window.scrollY > 32);
        },

        initBackToTopButton() {
            if (!this.elements.backToTopButton) return;
            this.elements.backToTopButton.addEventListener("click", (event) => {
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        },

        initMobileMenu() {
            if (!this.elements.openMenuBtn || !this.elements.closeMenuBtn || !this.elements.mobileMenu) return;

            const openMenu = () => {
                this.elements.mobileMenu.classList.remove("hidden");
                document.body.classList.add("menu-open");
                this.elements.closeMenuBtn.focus({ preventScroll: true });
            };

            const closeMenu = () => {
                this.elements.mobileMenu.classList.add("hidden");
                document.body.classList.remove("menu-open");
                this.elements.openMenuBtn.focus({ preventScroll: true });
            };

            this.elements.openMenuBtn.addEventListener("click", openMenu);
            this.elements.closeMenuBtn.addEventListener("click", closeMenu);
            this.elements.mobileMenu.addEventListener("click", (event) => {
                if (event.target === this.elements.mobileMenu) {
                    closeMenu();
                }
            });

            this.elements.mobileMenu.querySelectorAll("a").forEach((link) => {
                link.addEventListener("click", () => {
                    closeMenu();
                });
            });

            window.addEventListener("keydown", (event) => {
                if (event.key === "Escape" && !this.elements.mobileMenu.classList.contains("hidden")) {
                    closeMenu();
                }
            });
        },

        initNavLinksSmoothScroll() {
            document.querySelectorAll('a.nav-link[href^="#"]').forEach((anchor) => {
                anchor.addEventListener("click", (event) => {
                    event.preventDefault();
                    const target = document.querySelector(anchor.getAttribute("href"));
                    this.scrollToElement(target);
                });
            });
        },

        initKeyboardShortcuts() {
            let isScrolling = false;
            let scrollTimeout;

            window.addEventListener("keydown", (event) => {
                if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;

                if (event.key.toLowerCase() === "b") {
                    event.preventDefault();
                    this.triggerPrimaryBooking();
                    return;
                }

                if ((event.key !== "ArrowDown" && event.key !== "ArrowUp") || isScrolling) return;

                event.preventDefault();
                const currentScroll = window.scrollY;
                let nextSectionIndex = -1;

                if (event.key === "ArrowDown") {
                    for (let i = 0; i < this.elements.sections.length; i += 1) {
                        if (this.elements.sections[i].offsetTop > currentScroll + 80) {
                            nextSectionIndex = i;
                            break;
                        }
                    }
                } else {
                    for (let i = this.elements.sections.length - 1; i >= 0; i -= 1) {
                        if (this.elements.sections[i].offsetTop < currentScroll - 80) {
                            nextSectionIndex = i;
                            break;
                        }
                    }
                }

                if (nextSectionIndex === -1) return;

                isScrolling = true;
                this.scrollToElement(this.elements.sections[nextSectionIndex]);
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    isScrolling = false;
                }, 700);
            });
        },

        getHeaderOffset() {
            const headerHeight = this.elements.header?.offsetHeight || 0;
            const extraOffset = window.innerWidth >= 1200 ? 28 : 18;
            return headerHeight + extraOffset;
        },

        scrollToElement(element) {
            if (!element) return;
            const top = Math.max(
                0,
                element.getBoundingClientRect().top + window.scrollY - this.getHeaderOffset()
            );

            window.scrollTo({
                top,
                behavior: "smooth",
            });
        },

        updateActiveLink() {
            const navLinks = document.querySelectorAll("nav a.nav-link");
            let currentSectionId = "";
            const checkpoint = window.scrollY + this.getHeaderOffset() + window.innerHeight * 0.15;

            this.elements.sections.forEach((section) => {
                if (section.offsetTop <= checkpoint) {
                    currentSectionId = section.id;
                }
            });

            navLinks.forEach((link) => {
                link.classList.toggle("active", link.getAttribute("href") === `#${currentSectionId}`);
            });
        },

        updateProgressBar() {
            if (!this.elements.progressBar) return;
            const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolledPercentage = scrollableHeight > 0 ? (window.scrollY / scrollableHeight) * 100 : 0;
            this.elements.progressBar.style.width = `${scrolledPercentage}%`;
        },

        updateMobileDockState() {
            if (!this.elements.heroSection) {
                document.body.classList.remove("dock-muted");
                return;
            }

            if (window.innerWidth > 767) {
                document.body.classList.remove("dock-muted");
                return;
            }

            const heroRect = this.elements.heroSection.getBoundingClientRect();
            const shouldMuteDock = heroRect.bottom > window.innerHeight * 0.88;
            document.body.classList.toggle("dock-muted", shouldMuteDock);
        },

        updateScrollState() {
            this.elements.header?.classList.toggle("scrolled", window.scrollY > 32);
            this.elements.backToTopButton?.classList.toggle("visible", window.scrollY > 420);
            this.elements.scrollPrompt?.classList.toggle("is-hidden", window.scrollY > 60);

            this.updateActiveLink();
            this.updateProgressBar();
            this.updateMobileDockState();
        },

        shouldUseThreeJS() {
            return (
                !!this.elements.threeCanvas &&
                !this.prefersReducedMotion.matches &&
                window.innerWidth >= 960
            );
        },

        initThreeJS() {
            if (!this.shouldUseThreeJS()) {
                if (this.elements.threeCanvas) this.elements.threeCanvas.style.display = "none";
                return Promise.resolve();
            }

            if (this.renderer) return Promise.resolve();

            return this.loadThreeJSScript().then((Three) => {
                if (!this.shouldUseThreeJS() || this.renderer) return;

                try {
                    this.threeClock = new Three.Clock();
                    this.scene = new Three.Scene();
                    this.camera = new Three.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                    this.camera.position.z = 52;

                    this.renderer = new Three.WebGLRenderer({
                        canvas: this.elements.threeCanvas,
                        alpha: true,
                        antialias: false,
                        powerPreference: "low-power",
                    });
                    this.renderer.setSize(window.innerWidth, window.innerHeight);
                    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
                    this.elements.threeCanvas.style.display = "block";

                    const particleCount = 650;
                    const positions = new Float32Array(particleCount * 3);
                    for (let i = 0; i < particleCount * 3; i += 1) {
                        positions[i] = (Math.random() - 0.5) * 110;
                    }

                    this.particleGeometry = new Three.BufferGeometry();
                    this.particleGeometry.setAttribute("position", new Three.BufferAttribute(positions, 3));
                    this.particleMaterial = new Three.PointsMaterial({
                        color: 0xd9e3f0,
                        size: 0.04,
                        transparent: true,
                        opacity: 0.12,
                    });

                    this.particles = new Three.Points(this.particleGeometry, this.particleMaterial);
                    this.scene.add(this.particles);
                } catch (error) {
                    console.error("Three.js initialization failed:", error);
                    this.destroyThreeJS();
                }
            });
        },

        loadThreeJSScript() {
            if (typeof window.THREE !== "undefined") {
                return Promise.resolve(window.THREE);
            }

            const existingScript = document.querySelector('script[data-three-js="true"]');
            if (existingScript?.dataset.loaded === "true") {
                return Promise.resolve(window.THREE);
            }

            if (this.threeReadyPromise) {
                return this.threeReadyPromise;
            }

            this.threeReadyPromise = new Promise((resolve, reject) => {
                const threeScript = document.querySelector('script[data-three-js="true"]');

                const handleLoad = () => {
                    if (threeScript) threeScript.dataset.loaded = "true";
                    if (typeof window.THREE !== "undefined") {
                        resolve(window.THREE);
                        return;
                    }

                    this.threeReadyPromise = null;
                    reject(new Error("Three.js did not initialize correctly."));
                };

                const handleError = () => {
                    this.threeReadyPromise = null;
                    reject(new Error("Three.js failed to load."));
                };

                if (threeScript?.dataset.loaded === "true") {
                    resolve(window.THREE);
                    return;
                }

                if (threeScript) {
                    threeScript.addEventListener("load", handleLoad, { once: true });
                    threeScript.addEventListener("error", handleError, { once: true });
                    return;
                }

                const script = document.createElement("script");
                script.src = THREE_JS_URL;
                script.async = true;
                script.defer = true;
                script.dataset.threeJs = "true";
                script.addEventListener("load", () => {
                    script.dataset.loaded = "true";
                    handleLoad();
                }, { once: true });
                script.addEventListener("error", handleError, { once: true });
                document.head.appendChild(script);
            });

            return this.threeReadyPromise;
        },

        destroyThreeJS() {
            this.stopAnimation();

            if (this.particles && this.scene) {
                this.scene.remove(this.particles);
            }
            if (this.particleGeometry) this.particleGeometry.dispose();
            if (this.particleMaterial) this.particleMaterial.dispose();
            if (this.renderer) this.renderer.dispose();
            if (this.elements.threeCanvas) this.elements.threeCanvas.style.display = "none";

            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.particles = null;
            this.particleGeometry = null;
            this.particleMaterial = null;
            this.threeClock = null;
            this.threeMouse = { x: 0, y: 0 };
        },

        addEventListeners() {
            const motionChangeHandler = this.onWindowResize.bind(this);
            window.addEventListener("resize", this.onWindowResize.bind(this), { passive: true });
            window.addEventListener("scroll", this.onScroll.bind(this), { passive: true });
            document.addEventListener("click", this.onDocumentClick.bind(this));
            document.addEventListener("visibilitychange", this.onVisibilityChange.bind(this));
            if (typeof this.prefersReducedMotion.addEventListener === "function") {
                this.prefersReducedMotion.addEventListener("change", motionChangeHandler);
            } else if (typeof this.prefersReducedMotion.addListener === "function") {
                this.prefersReducedMotion.addListener(motionChangeHandler);
            }
        },

        onScroll() {
            this.updateScrollState();
        },

        onDocumentClick(event) {
            const clickedLink = event.target.closest("a[href]");
            if (clickedLink) {
                this.trackLinkInteraction(clickedLink);
            }

            if (event.target.closest("[data-resume-capture]")) return;
            this.closeResumeCaptures();
        },

        onWindowResize() {
            this.updateScrollState();

            if (!this.shouldUseThreeJS()) {
                if (this.renderer) this.destroyThreeJS();
                return;
            }

            if (!this.renderer) {
                this.initThreeJS()
                    .then(() => {
                        this.startAnimation();
                    })
                    .catch((error) => {
                        console.error("Three.js resize setup failed:", error);
                    });
                return;
            }

            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        },

        onVisibilityChange() {
            if (document.hidden) {
                this.stopAnimation();
            } else {
                this.startAnimation();
            }
        },

        animate() {
            if (!this.scene || !this.renderer || !this.camera) {
                this.animationFrameId = null;
                return;
            }

            this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
            const elapsedTime = this.threeClock ? this.threeClock.getElapsedTime() : 0;

            if (this.particles) {
                this.particles.rotation.y = elapsedTime * 0.004;
                this.particles.rotation.x = elapsedTime * 0.002;
            }

            this.camera.position.x += (this.threeMouse.x * 0.8 - this.camera.position.x) * 0.012;
            this.camera.position.y += (-this.threeMouse.y * 0.8 - this.camera.position.y) * 0.012;
            this.camera.lookAt(this.scene.position);
            this.renderer.render(this.scene, this.camera);
        },

        startAnimation() {
            if (this.animationFrameId || !this.scene || !this.renderer) return;
            this.animate();
        },

        stopAnimation() {
            if (!this.animationFrameId) return;
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        },
    };

    App.init();
});
