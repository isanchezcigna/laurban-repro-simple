document.addEventListener('DOMContentLoaded', () => {
    // Rutas de las imágenes
    const logoUrl = 'https://radio.laurban.cl/static/uploads/laurban/logo.png';
    const instagramUrl = 'https://radio.laurban.cl/static/uploads/laurban/instagram.png';

    // Crear elementos de imagen
    const logo = document.createElement('img');
    logo.id = 'logo';
    logo.src = logoUrl;
    logo.alt = 'Logo';

    const instagram = document.createElement('img');
    instagram.id = 'instagram';
    instagram.src = instagramUrl;
    instagram.alt = 'Instagram';
    instagram.style.cursor = 'pointer';
    instagram.onclick = function() {
        window.open('https://instagram.com/laurban.cl', '_blank');
    };
    instagram.onmouseover = function() {
       instagram.style.opacity = '0.7'; // Cambia la opacidad como ejemplo
    };

    // Evento onmouseout para revertir el estilo cuando el mouse sale de la imagen
    instagram.onmouseout = function() {
       instagram.style.opacity = '1'; // Revertir la opacidad
    };

    // Agregar elementos de imagen al main
    const main = document.querySelector('main');
    main.insertBefore(logo, main.firstChild);
    main.appendChild(instagram);

    // Ajustar el estilo del reproductor
    const player = document.querySelector('.public-page .radio-player-widget');
    if (player) {
        player.style.maxHeight = '300px'; // Ajusta el alto máximo del reproductor
        player.style.width = '100%';
        player.style.maxWidth = '600px'; // Ajusta el ancho máximo del reproductor
    }

    // Crear botón para abrir el chat
    const openChatButton = document.createElement('button');
    openChatButton.id = 'openChatButton';
    openChatButton.textContent = 'Chatear';

    openChatButton.onmouseover = function() {
      openChatButton.style.opacity = '0.7';
    };

    openChatButton.onmouseout = function() {
      openChatButton.style.opacity = '1'
    };

      // Manejar la apertura del chat en una nueva ventana
    openChatButton.addEventListener('click', () => {
        window.open('https://www.twitch.tv/popout/laurbancl/chat?popout=', '_blank', 'width=400,height=600');
    });
  
    document.body.appendChild(openChatButton);


    // Esperar a que el reproductor esté completamente cargado
    const observer = new MutationObserver(() => {
       const cardTitle = document.querySelector('h2.card-title.mb-3');
       const divToModify = document.querySelector('.card-body.buttons.pt-0');
       const player = document.querySelector('.public-page .radio-player-widget');

       // Verifica si el elemento existe antes de intentar eliminarlo
       if (divToModify) {
           const links = divToModify.querySelectorAll('a');
           if (links.length > 2) {
               // Elimina el primer y el último elemento <a>
               links[0].remove();
               links[links.length - 1].remove();
             
               // Mover el elemento <a> restante al nuevo contenedor
               const remainingLink = divToModify.querySelector('a');
               const radioControls = document.querySelector('.radio-controls');
               const playButton = radioControls.querySelector('.radio-control-play-button');

               if (remainingLink && radioControls && playButton) {
                   playButton.insertAdjacentElement('afterend', remainingLink);
                   remainingLink.style.marginLeft = '10px'; // Añadir un pequeño margen de separación
                   remainingLink.classList.remove('text-secondary');
                   remainingLink.classList.add('text-primary');
               }
               // Dejar invisible el div
               divToModify.style.display = 'none';

           } else {
               console.log('No hay suficientes elementos <a> para eliminar.');
           }
       } else {
           console.log('El elemento no existe.');
       }

       if (cardTitle) {
            cardTitle.remove(); // Elimina el elemento h2
       }


       observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
});
