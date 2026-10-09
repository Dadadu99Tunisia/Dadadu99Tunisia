#!/usr/bin/env bash
# Assemblage du film SIGILLE : minutage → musique → (voix) → mixage → encodages.
#
#   bash tools/assemble.sh            # suppose build/video_clean.mp4 déjà rendu
#   bash tools/assemble.sh --render   # rend aussi la vidéo (node tools/render.mjs all 4)
#
# Voix off : déposer un fichier voix/<id>.wav par réplique (v01 … v29, voir script/narration.json).
# Le minutage, les sous-titres et le mixage s'adaptent alors aux durées réelles. Sans voix, le film
# est livré avec musique, sous-titres incrustés et une piste voix vide à remplacer.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build out

python3 tools/build_timeline.py
python3 tools/music.py
if [[ "${1:-}" == "--render" ]]; then node tools/render.mjs all 4; fi
[[ -f build/video_clean.mp4 ]] || { echo "build/video_clean.mp4 absent : lancez avec --render"; exit 1; }

FONTS="render/assets/fonts/ttf"
NVOIX=$(ls voix/v*.wav 2>/dev/null | wc -l || true)

if [[ "$NVOIX" -gt 0 ]]; then
  echo "Voix off : $NVOIX répliques trouvées, placement sur la timeline."
  # Une entrée par réplique, retardée à son instant de départ (build/timeline.json).
  ARGS=(); FILT=""; i=0
  while IFS=$'\t' read -r id start; do
    ARGS+=(-i "voix/$id.wav"); ms=$(python3 -c "print(int(round($start*1000)))")
    FILT+="[$i:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v$i];"; i=$((i+1))
  done < <(python3 -c "
import json; t=json.load(open('build/timeline.json'))
import os
for r in t['repliques']:
    if os.path.exists(f'voix/{r[\"id\"]}.wav'): print(r['id'], r['start'], sep='\t')")
  MIXIN=""; for ((k=0;k<i;k++)); do MIXIN+="[v$k]"; done
  ffmpeg -y -loglevel error "${ARGS[@]}" -filter_complex "${FILT}${MIXIN}amix=inputs=$i:normalize=0,apad=whole_dur=300[vo]" \
    -map "[vo]" -t 300 -c:a pcm_s24le build/voix.wav
  # La musique s'efface sous la voix (compression en sidechain), puis normalisation web.
  ffmpeg -y -loglevel error -i build/musique.wav -i build/voix.wav -filter_complex \
    "[0:a]volume=-8dB[m];[1:a]asplit=2[vo1][vo2];[m][vo1]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[md];[md][vo2]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
    -map "[a]" -ar 48000 -c:a pcm_s24le build/mix.wav
else
  echo "Aucune voix off dans voix/ : musique seule, piste voix vide fournie à part."
  ffmpeg -y -loglevel error -i build/musique.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -c:a pcm_s24le build/mix.wav
  ffmpeg -y -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t 300 -c:a pcm_s24le out/SIGILLE_voix_off_A_REMPLACER.wav
fi

# Stems pour le mixage final avec la voix (musique au niveau de « lit »).
ffmpeg -y -loglevel error -i build/musique.wav -af "loudnorm=I=-24:TP=-3" -ar 48000 -c:a pcm_s24le out/SIGILLE_musique_lit_-24LUFS.wav

SUBS="ass=build/sous-titres.ass:fontsdir=$FONTS"
# Master 1080p25 : sous-titres incrustés, H.264 haute qualité, AAC 320 kb/s.
ffmpeg -y -loglevel error -i build/video_clean.mp4 -i build/mix.wav -vf "$SUBS" \
  -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p -r 25 -g 50 \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart -metadata title="SIGILLE · film de lancement" -metadata language=fra \
  -shortest out/SIGILLE_film_FR_master_1080p25.mp4
# Version sans sous-titres incrustés (pour post-production de la voix off ou sous-titres activables).
ffmpeg -y -loglevel error -i build/video_clean.mp4 -i build/mix.wav \
  -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p -r 25 -g 50 \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest out/SIGILLE_film_FR_sans-sous-titres_1080p25.mp4
# Version web compressée : sous-titres incrustés, démarrage rapide.
ffmpeg -y -loglevel error -i build/video_clean.mp4 -i build/mix.wav -vf "$SUBS" \
  -c:v libx264 -preset slow -crf 24 -profile:v high -pix_fmt yuv420p -r 25 -g 50 -maxrate 4M -bufsize 8M \
  -c:a aac -b:a 160k -ar 48000 -movflags +faststart -metadata title="SIGILLE · film de lancement" -metadata language=fra \
  -shortest out/SIGILLE_film_FR_web.mp4

ls -la out/
