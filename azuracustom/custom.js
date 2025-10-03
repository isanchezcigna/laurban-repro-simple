/**
 * Personalizaciones para la página pública de AzuraCast
 * Agrega elementos personalizados, modifica el reproductor y gestiona el chat
 */

(function () {
    'use strict';

    // Configuración de URLs e imágenes
    const CONFIG = {
        LOGO_URL: 'https://azura.laurban.cl/static/uploads/laurban/logo.png',
        INSTAGRAM_IMAGE_URL: 'https://azura.laurban.cl/static/uploads/laurban/instagram.png',
        INSTAGRAM_LINK: 'https://instagram.com/laurban.cl',
        CHAT_POPUP_URL: 'https://www.twitch.tv/popout/laurbancl/chat?popout=',
        CHAT_POPUP_WIDTH: 400,
        CHAT_POPUP_HEIGHT: 600,
        HOVER_OPACITY: '0.7',
        DEFAULT_OPACITY: '1'
    };

    // Selectores CSS
    const SELECTORS = {
        MAIN: 'main',
        PLAYER: '.public-page .radio-player-widget',
        CARD_TITLE: 'h2.card-title.mb-3',
        BUTTONS_DIV: '.card-body.buttons.pt-0',
        RADIO_CONTROLS: '.radio-controls',
        PLAY_BUTTON: '.radio-control-play-button'
    };

    /**
     * Crea un elemento de imagen con los atributos especificados
     * @param {Object} config - Configuración de la imagen
     * @returns {HTMLImageElement} Elemento de imagen creado
     */
    function createImageElement(config) {
        const img = document.createElement('img');
        img.id = config.id;
        img.src = config.src;
        img.alt = config.alt;
        
        if (config.cursor) {
            img.style.cursor = config.cursor;
        }
        
        return img;
    }

    /**
     * Agrega efectos hover a un elemento
     * @param {HTMLElement} element - Elemento al que agregar los efectos
     */
    function addHoverEffects(element) {
        element.addEventListener('mouseover', () => {
            element.style.opacity = CONFIG.HOVER_OPACITY;
        });

        element.addEventListener('mouseout', () => {
            element.style.opacity = CONFIG.DEFAULT_OPACITY;
        });
    }

    /**
     * Crea el elemento del logo
     * @returns {HTMLImageElement} Elemento del logo
     */
    function createLogo() {
        return createImageElement({
            id: 'logo',
            src: CONFIG.LOGO_URL,
            alt: 'Logo'
        });
    }

    /**
     * Crea el botón de Instagram
     * @returns {HTMLImageElement} Elemento de Instagram
     */
    function createInstagramButton() {
        const instagram = createImageElement({
            id: 'instagram',
            src: CONFIG.INSTAGRAM_IMAGE_URL,
            alt: 'Instagram',
            cursor: 'pointer'
        });

        instagram.addEventListener('click', () => {
            window.open(CONFIG.INSTAGRAM_LINK, '_blank', 'noopener,noreferrer');
        });

        addHoverEffects(instagram);

        return instagram;
    }

    /**
     * Agrega los elementos de imagen al main
     */
    function addImageElements() {
        const main = document.querySelector(SELECTORS.MAIN);
        
        if (!main) {
            console.error('No se encontró el elemento main');
            return;
        }

        const logo = createLogo();
        const instagram = createInstagramButton();

        main.insertBefore(logo, main.firstChild);
        main.appendChild(instagram);
    }

    /**
     * Ajusta los estilos del reproductor
     */
    function adjustPlayerStyles() {
        const player = document.querySelector(SELECTORS.PLAYER);
        
        if (!player) {
            return;
        }

        player.style.maxHeight = '300px';
        player.style.width = '100%';
        player.style.maxWidth = '600px';
    }

    /**
     * Crea el botón para abrir el chat
     * @returns {HTMLButtonElement} Botón de chat creado
     */
    function createChatButton() {
        const button = document.createElement('button');
        button.id = 'openChatButton';
        button.textContent = 'Chatear';

        addHoverEffects(button);

        button.addEventListener('click', () => {
            const features = `width=${CONFIG.CHAT_POPUP_WIDTH},height=${CONFIG.CHAT_POPUP_HEIGHT}`;
            window.open(CONFIG.CHAT_POPUP_URL, '_blank', features);
        });

        return button;
    }

    /**
     * Agrega el botón de chat al body
     */
    function addChatButton() {
        const chatButton = createChatButton();
        document.body.appendChild(chatButton);
    }

    /**
     * Modifica los botones de la tarjeta del reproductor
     */
    function modifyCardButtons() {
        const divToModify = document.querySelector(SELECTORS.BUTTONS_DIV);
        
        if (!divToModify) {
            console.log('El elemento de botones no existe.');
            return false;
        }

        const links = divToModify.querySelectorAll('a');
        
        if (links.length < 3) {
            console.log('No hay suficientes elementos <a> para eliminar.');
            return false;
        }

        // Eliminar primer y último enlace
        links[0].remove();
        links[links.length - 1].remove();

        // Mover el enlace restante
        const remainingLink = divToModify.querySelector('a');
        const radioControls = document.querySelector(SELECTORS.RADIO_CONTROLS);
        const playButton = radioControls?.querySelector(SELECTORS.PLAY_BUTTON);

        if (remainingLink && playButton) {
            playButton.insertAdjacentElement('afterend', remainingLink);
            remainingLink.style.marginLeft = '10px';
            remainingLink.classList.remove('text-secondary');
            remainingLink.classList.add('text-primary');
        }

        // Ocultar el div
        divToModify.style.display = 'none';
        
        return true;
    }

    /**
     * Elimina el título de la tarjeta
     */
    function removeCardTitle() {
        const cardTitle = document.querySelector(SELECTORS.CARD_TITLE);
        
        if (cardTitle) {
            cardTitle.remove();
        }
    }

    /**
     * Observa cambios en el DOM para modificar el reproductor cuando esté cargado
     */
    function observePlayerLoad() {
        const observer = new MutationObserver(() => {
            const cardTitle = document.querySelector(SELECTORS.CARD_TITLE);
            const divToModify = document.querySelector(SELECTORS.BUTTONS_DIV);

            // Verificar si los elementos existen para proceder
            if (cardTitle || divToModify) {
                modifyCardButtons();
                removeCardTitle();
                observer.disconnect();
            }
        });

        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }

    /**
     * Inicializa todas las personalizaciones
     */
    function init() {
        addImageElements();
        adjustPlayerStyles();
        addChatButton();
        observePlayerLoad();
    }

    // Iniciar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', init);

})();

