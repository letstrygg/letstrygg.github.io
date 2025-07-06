<html lang="en">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Page Title</title>
<style>
  body {
    height: 100%;
    display: flex;
    margin: 0 auto;
    width: 90%;
    max-width: 1240px;
    font-family: 'Roboto', sans-serif;
    background-color: #f6f6f6;
  }
  header{
    display: flex;
    padding: 30px 0;
    background-color: #ccffcc;
  }
  main {
    display: flex;
    flex-wrap: wrap;
  }
  main h1 {
    flex-basis: 100%;
    background-color: #ccccff;
  }
  img {
    max-width: 100%;
  }
  .card {
    padding: 2%;
    flex-grow: 1;
    flex-basis: 16%;
    display: flex;

    border: 1px;
    border-style: solid;
    border-color: #444444;
  }
  @media ( max-width: 920px ) {
  }
  @media ( max-width: 600px ) {
  }
  @media ( max-width: 480px ) {
  }
  footer{
    margin-top: auto;
  }
</style>
</head>

<body>
  <header>Header</header>
  <nav>Navigation</nav>
  <h1>Test h1 outside of main</h1>
  <main>
    <h1>Shirts</h1>

    <div class="card">
      <a href="https://www.google.com/url?q=https%3A%2F%2Famzn.to%2F3x0EtOn&sa=D&sntz=1&usg=AOvVaw0QMj-aWNzB3SML5Kf7CYMj">
        <img src="/images/shirts/abstract-diamonds-heather-blue.jpg">
        Geometric Diamonds<br>
        Abstract Minimalist Art - Peach Ombre T-Shirt
      </a>
    </div>
    <div class="card">
      <a href="https://www.google.com/url?q=https%3A%2F%2Famzn.to%2F3x0EtOn&sa=D&sntz=1&usg=AOvVaw0QMj-aWNzB3SML5Kf7CYMj">
        <img src="/images/shirts/abstract-diamonds-heather-blue.jpg">
        Geometric Diamonds<br>
        Abstract Minimalist Art - Peach Ombre T-Shirt
      </a>
    </div>
    <div class="card">
      <a href="https://www.google.com/url?q=https%3A%2F%2Famzn.to%2F3x0EtOn&sa=D&sntz=1&usg=AOvVaw0QMj-aWNzB3SML5Kf7CYMj">
        <img src="/images/shirts/abstract-diamonds-heather-blue.jpg">
        Geometric Diamonds<br>
        Abstract Minimalist Art - Peach Ombre T-Shirt
      </a>
    </div>

  </main>
  <footer>Footer</footer>
</body>
</html>
