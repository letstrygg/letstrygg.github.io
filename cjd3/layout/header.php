<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-7G0RL6FL5K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-7G0RL6FL5K');
  </script>

  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Catamaran:wght@900|Nunito">
  <title><?php echo $title; ?></title>
  <meta name="description" content="<?php echo $description; ?>">
</head>
<body>
    <header>

      <div class="top-container">
        <h1>cjd3</h1>
      </div>
      <div class="header" id="myHeader">
      <nav>
        <a href="/index.php">Home</a>
      </nav>
      </div>

      <script>
        window.onscroll = function() {myFunction()};

        var header = document.getElementById("myHeader");
        var sticky = header.offsetTop;

        function myFunction() {
          if (window.pageYOffset > sticky) {
            header.classList.add("sticky");
          } else {
            header.classList.remove("sticky");
          }
        }
      </script>

    </header>

<div class="content">
