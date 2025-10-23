document.addEventListener("DOMContentLoaded", async () => {
  const yearSelect = document.getElementById("year-select");
  const citySelect = document.getElementById("city-select");
  const searchInput = document.getElementById("sa3-search");

  const yearLabels = {
    2018: "2017–18",
    2019: "2018–19",
    2020: "2019–20",
    2021: "2020–21",
    2022: "2021–22"
  };

  const embedOptions = { actions: false, renderer: "canvas" };

  const [
    kpiResult,
    overviewResult,
    cityResult,
    stateTrendResult,
    salaryShareResult,
    sa3Result,
    timeseriesResult,
    distributionResult
  ] = await Promise.all([
    vegaEmbed("#kpi-vis", "specs/kpi_cards.vg.json", embedOptions),
    vegaEmbed("#overview-vis", "specs/state_overview.vg.json", embedOptions),
    vegaEmbed("#city-vis", "specs/city_comparator.vg.json", embedOptions),
    vegaEmbed("#state-trend-vis", "specs/state_trend.vg.json", embedOptions),
    vegaEmbed("#salary-share-vis", "specs/salary_share.vg.json", embedOptions),
    vegaEmbed("#sa3-vis", "specs/sa3_map_rank.vg.json", embedOptions),
    vegaEmbed("#timeseries-vis", "specs/time_series.vg.json", embedOptions),
    vegaEmbed("#distribution-vis", "specs/distribution.vg.json", embedOptions)
  ]);

  const views = {
    kpi: kpiResult.view,
    overview: overviewResult.view,
    city: cityResult.view,
    stateTrend: stateTrendResult.view,
    salaryShare: salaryShareResult.view,
    sa3: sa3Result.view,
    timeseries: timeseriesResult.view,
    distribution: distributionResult.view
  };

  function debounce(fn, wait = 150) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  async function setSignals(view, mapping) {
    if (!view) {
      return;
    }
    let dirty = false;
    for (const [name, value] of Object.entries(mapping)) {
      if (typeof view.signal !== "function") {
        continue;
      }
      try {
        const current = view.signal(name);
        const bothNaN = Number.isNaN(current) && Number.isNaN(value);
        if (current === value || bothNaN) {
          continue;
        }
        view.signal(name, value);
        dirty = true;
      } catch (error) {
        // Ignore missing signals on a view.
      }
    }
    if (dirty) {
      await view.runAsync();
    }
  }

  let previousCity = citySelect.value;

  const updateYearDrivenViews = async () => {
    const yearValue = Number(yearSelect.value);
    const yearLabel = yearLabels[yearValue] || `${yearValue - 1}–${yearValue}`;

    await setSignals(views.kpi, {
      yearParam: yearValue,
      yearLabelParam: yearLabel
    });

    await setSignals(views.overview, {
      yearParam: yearValue
    });

    await setSignals(views.city, {
      yearParam: yearValue
    });

    await setSignals(views.salaryShare, {
      yearParam: yearValue
    });

    await setSignals(views.stateTrend, {
      yearParam: yearValue
    });

    await setSignals(views.sa3, {
      yearParam: yearValue
    });

    await setSignals(views.timeseries, {
      yearParam: yearValue
    });

    await setSignals(views.distribution, {
      yearParam: yearValue
    });
  };

  const updateCityDrivenViews = async () => {
    const cityValue = citySelect.value;
    let searchValue = searchInput.value.trim();

    if (previousCity !== cityValue) {
      searchInput.value = "";
      searchValue = "";
    }

    await setSignals(views.sa3, {
      cityParam: cityValue,
      searchParam: searchValue
    });

    await setSignals(views.distribution, {
      cityParam: cityValue
    });

    if (previousCity !== cityValue) {
      try {
        views.sa3.signal("sa3_select", null);
        await views.sa3.runAsync();
      } catch (error) {
        console.warn("Unable to reset SA3 selection:", error);
      }
      previousCity = cityValue;
    }
  };

  const handleSearchInput = debounce(async () => {
    await setSignals(views.sa3, {
      searchParam: searchInput.value.trim()
    });
  });

  yearSelect.addEventListener("change", () => {
    updateYearDrivenViews();
  });

  citySelect.addEventListener("change", () => {
    updateCityDrivenViews();
  });

  searchInput.addEventListener("input", handleSearchInput);

  // Initial renders
  await updateYearDrivenViews();
  await updateCityDrivenViews();
});
