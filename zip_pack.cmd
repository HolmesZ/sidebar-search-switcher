:: zip_pack.cmd
@echo off
cd /d %~dp0
7z a sidebar-search-switcher.zip _locales content icons options popup data.json manifest.json
echo Zip package created: sidebar-search-switcher.zip
