module.exports = {
  content: [
    './**/*.html',
    './assets/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        navy: '#212936',
        'navy-dark': '#1a2030',
        orange: '#B77537',
        'orange-dark': '#9a6230',
        cream: '#F2EDDC',
        'dark-text': '#222222'
      },
      fontFamily: {
        sans: ['urw-din', 'Arial', 'Helvetica Neue', 'Helvetica', 'sans-serif'],
        heading: ['urw-din', 'Arial', 'Helvetica Neue', 'Helvetica', 'sans-serif']
      }
    }
  }
};
