# Multiplayer online fino a 3 giocatori

## Esperienza di gioco
- Aggiungere nella schermata iniziale le opzioni **Crea stanza** e **Entra con codice**.
- Generare un codice breve da condividere con altri due giocatori, ciascuno dal proprio dispositivo.
- Mostrare la sala d’attesa con i giocatori presenti; il creatore avvia la partita quando sono pronti.
- Sincronizzare posizione, direzione, vita, round, zombie e cancelli per far vedere la stessa partita a tutti.
- Gestire uscita e disconnessione senza bloccare gli altri partecipanti.

## Progressi personali
- Tenere separati per ogni giocatore arma, munizioni, perk e potenziamento Pack-a-Punch.
- Gli acquisti personali non modificano equipaggiamento o bonus degli altri.
- Punti e aperture dei cancelli restano condivisi, come richiesto implicitamente dalla selezione delle sole categorie personali.

## Dettagli tecnici
- Usare Lovable Cloud e aggiornamenti in tempo reale per stanze, partecipanti e stato della partita.
- Accesso ospite automatico: nessuna registrazione obbligatoria per entrare nella stanza.
- Limitare ogni stanza a 3 partecipanti e proteggere i dati affinché solo i membri possano leggerli o aggiornarli.
- Mantenere separate le modalità PC, telefono e controller PlayStation già esistenti.
- Verificare creazione stanza, ingresso con secondo dispositivo, limite di 3 e isolamento di armi/perk.
