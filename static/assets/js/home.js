const SplashT = [
  "Made by @lunar.undetected",
  "Check out discord.gg/lunarstudio :)",
  "Thanks for using the site",
  "Follow me on tiktok! @lunar.undetected",
  "Check out the settings page",
  "Join LunarStudios on discord for updates and recommendations for games and more! (.gg/lunarstudio)",
];

let SplashI = Math.floor(Math.random() * SplashT.length);
const SplashE = document.getElementById("splash");

function US() {
  SplashI = (SplashI + 1) % SplashT.length;
  SplashE.innerText = SplashT[SplashI];
  SplashE.style.animation = "none";
  void SplashE.offsetWidth;
  SplashE.style.animation = "";
}

SplashE.innerText = SplashT[SplashI];
SplashE.addEventListener("click", US);
