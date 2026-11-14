# Hand Pong Online

Browser-Pong für zwei Spieler. Jeder steuert sein Paddle, indem er die Hand vor
die eigene Webcam hält; die Verbindung zwischen den Spielern läuft direkt
per WebRTC (PeerJS), es ist kein eigener Server nötig — passt daher zu
itch.io's statischem HTML5-Hosting.

## Lokal testen

Browser verweigern Kamerazugriff bei `file://`-URLs, deshalb muss ein kleiner
lokaler Server laufen:

```
cd ponggame
python3 -m http.server 8787
```

Dann im Browser `http://localhost:8787` öffnen — **zweimal** (zwei Tabs,
oder noch besser zwei Geräte im selben Netz), einmal "Raum erstellen",
im zweiten Tab mit dem 5-stelligen Code "Beitreten".

## Ablauf im Spiel

1. Host erstellt einen Raum → bekommt einen Code → schickt ihn dem Gegner.
2. Gegner tritt mit dem Code bei.
3. Beide erlauben Kamerazugriff, halten die Hand vor die Kamera und klicken
   "Ich bin bereit", sobald "Hand erkannt" angezeigt wird.
4. 3-2-1-Countdown, dann startet das Spiel. Erster auf 7 Punkte gewinnt.
5. Fällt die Kamera aus / wird der Zugriff verweigert, kann über den Button
   "Stattdessen Tastatur benutzen (W/S)" weitergespielt werden.

## Upload auf itch.io

1. Zippe den **Inhalt** des `ponggame`-Ordners (`index.html` muss direkt in
   der Zip-Wurzel liegen, nicht in einem Unterordner).
2. Neues Projekt auf itch.io → Kind "HTML" → die Zip-Datei hochladen.
3. Haken bei "This file will be played in the browser" setzen.
4. Embed-Maße z. B. 1000×700, "Mobile friendly" aus (Webcam + zwei Browser
   werden gebraucht, kein Touch-Spiel).
5. Nach dem Veröffentlichen testen: itch.io erlaubt Kamera-Zugriff im
   eingebetteten iframe standardmäßig. Falls der Browser den Zugriff trotzdem
   blockiert, hilft der "Vollbild"-Link auf der Spielseite — er öffnet das
   Spiel in einem eigenen Tab ohne iframe-Einschränkungen.

## Bekannte Einschränkung

Die WebRTC-Verbindung nutzt nur öffentliche STUN-Server (keinen TURN-Server).
Das funktioniert in den allermeisten Heimnetzen, kann aber hinter sehr
restriktiven Firmen-/Uni-Firewalls fehlschlagen. Für den itch.io-Einsatz
unter Privatpersonen ist das in der Praxis kein Problem.
