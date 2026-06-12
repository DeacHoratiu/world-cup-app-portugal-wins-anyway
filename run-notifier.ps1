Set-Location "'your_path'\world-cup-app-portugal-wins-anyway-main" 

$env:NTFY_TOPIC="your_topic" 

$env:LOOP_MINUTES="0" 

node notifier\notify.js
