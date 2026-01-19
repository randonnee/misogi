document.addEventListener('DOMContentLoaded', function() {
  // View switching
  const viewModes = document.querySelectorAll('.view-mode');
  const views = document.querySelectorAll('.view');

  function showView(viewId) {
    // Hide all views
    views.forEach(view => {
      view.classList.remove('active');
    });

    // Show selected view
    const targetView = document.getElementById(viewId + '-view');
    if (targetView) {
      targetView.classList.add('active');
    }

    // Update nav active state
    viewModes.forEach(mode => {
      mode.classList.remove('active');
      if (mode.getAttribute('data-view') === viewId) {
        mode.classList.add('active');
      }
    });
  }

  function handleHashChange() {
    const hash = window.location.hash.slice(1) || 'now-playing';
    showView(hash);
  }

  // Handle hash changes
  window.addEventListener('hashchange', handleHashChange);

  // Handle initial load
  handleHashChange();

  // Theater filtering (for calendar view)
  const theaterFilters = document.querySelectorAll('.theater-filter');
  const movieItems = document.querySelectorAll('.movie-item');

  function updateDayVisibility() {
    const dayItems = document.querySelectorAll('.day-item');
    
    dayItems.forEach(dayItem => {
      const visibleMovieItems = dayItem.querySelectorAll('.movie-item[style="display: block;"], .movie-item:not([style])');
      const hasVisibleMovies = visibleMovieItems.length > 0;
      
      dayItem.style.display = hasVisibleMovies ? 'block' : 'none';
    });
  }

  theaterFilters.forEach(filter => {
    filter.addEventListener('click', function() {
      const selectedTheater = this.getAttribute('data-theater');
      
      // Update active state
      theaterFilters.forEach(f => f.classList.remove('active'));
      this.classList.add('active');
      
      // Filter movies
      movieItems.forEach(item => {
        const theaterId = item.getAttribute('data-theater-id');
        const shouldShow = selectedTheater === 'all' || theaterId === selectedTheater;
        
        item.style.display = shouldShow ? 'block' : 'none';
      });
      
      // Update day visibility after filtering
      updateDayVisibility();
    });
  });

  // Initialize day visibility on page load
  updateDayVisibility();
});
