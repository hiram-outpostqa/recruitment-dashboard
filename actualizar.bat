@echo off
cd C:\Dashboard
echo.
echo  Subiendo cambios al dashboard...
echo.
git add .
git commit -m "actualizacion dashboard"
git push
echo.
echo  Listo! El dashboard se actualizara en ~2 minutos.
echo  Link: https://recruitment-dashboard-production.up.railway.app
echo.
pause
